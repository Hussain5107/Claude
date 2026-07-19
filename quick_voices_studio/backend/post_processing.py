"""Optional 'studio' audio post-processing: pitch, warmth (EQ), reverb.

Piper itself has no expression controls beyond noise_scale/noise_w_scale
(handled in tts_engine.py, at synthesis time -- free, no extra pass over the
audio). Everything here runs once on the finished buffer, is pure numpy/scipy
(no extra ML dependency), and is deliberately simple: this is a fast, cheap
polish pass, not broadcast-grade mastering. Pitch shift in particular uses a
plain resample (changes formants along with pitch -- a "helium/deep voice"
character shift, not a formant-preserving shift) because that's the
difference between a near-instant effect and one that takes several times
longer than the synthesis itself to run.

Internals run in float32: audio is 16-bit to begin with, so float32's 24-bit
mantissa loses nothing audible, and it halves the working-memory footprint
of every full-signal buffer on a long narration.
"""

import numpy as np
from scipy.signal import lfilter


def _clip_to_dtype(float_audio: np.ndarray, dtype: np.dtype) -> np.ndarray:
    max_val = np.iinfo(dtype).max if np.issubdtype(dtype, np.integer) else 1.0
    return np.clip(float_audio, -max_val - 1, max_val).astype(dtype)


def pitch_shift(audio: np.ndarray, semitones: float) -> np.ndarray:
    """Resample-based pitch shift. Assumes the caller has already compensated
    Piper's length_scale so the result comes back near the original duration."""
    if semitones == 0 or len(audio) == 0:
        return audio

    ratio = 2.0 ** (semitones / 12.0)
    new_length = max(1, int(round(len(audio) / ratio)))
    # Vectorized linear interpolation, block-wise: full-length position/index
    # arrays cost ~500MB per 10 minutes of audio (float64 positions + int64
    # gather indices), so compute them a block at a time instead -- bounded
    # temporaries, identical output. Positions themselves must be float64:
    # beyond ~2^24 samples float32 can't represent sample indices exactly and
    # the fractional interpolation weight degrades audibly.
    samples = audio.astype(np.float32)
    out = np.empty(new_length, dtype=np.float32)
    step = (len(audio) - 1) / (new_length - 1) if new_length > 1 else 0.0
    block = 1 << 20
    for start in range(0, new_length, block):
        stop = min(start + block, new_length)
        positions = np.arange(start, stop, dtype=np.float64) * step
        left = positions.astype(np.int64)
        right = np.minimum(left + 1, len(audio) - 1)
        frac = (positions - left).astype(np.float32)
        out[start:stop] = samples[left] * (1.0 - frac) + samples[right] * frac
    return out.astype(audio.dtype)


def _shelf_coeffs(sr: int, freq_hz: float, gain_db: float, kind: str) -> tuple[np.ndarray, np.ndarray]:
    """RBJ low/high-shelf biquad coefficients (audio EQ cookbook formulas)."""
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * freq_hz / sr
    alpha = np.sin(w0) / 2 * np.sqrt((a + 1 / a) * (1 / 0.9 - 1) + 2)
    cos_w0 = np.cos(w0)
    sqrt_a = np.sqrt(a)

    if kind == "low":
        b0 = a * ((a + 1) - (a - 1) * cos_w0 + 2 * sqrt_a * alpha)
        b1 = 2 * a * ((a - 1) - (a + 1) * cos_w0)
        b2 = a * ((a + 1) - (a - 1) * cos_w0 - 2 * sqrt_a * alpha)
        a0 = (a + 1) + (a - 1) * cos_w0 + 2 * sqrt_a * alpha
        a1 = -2 * ((a - 1) + (a + 1) * cos_w0)
        a2 = (a + 1) + (a - 1) * cos_w0 - 2 * sqrt_a * alpha
    else:
        b0 = a * ((a + 1) + (a - 1) * cos_w0 + 2 * sqrt_a * alpha)
        b1 = -2 * a * ((a - 1) + (a + 1) * cos_w0)
        b2 = a * ((a + 1) + (a - 1) * cos_w0 - 2 * sqrt_a * alpha)
        a0 = (a + 1) - (a - 1) * cos_w0 + 2 * sqrt_a * alpha
        a1 = 2 * ((a - 1) - (a + 1) * cos_w0)
        a2 = (a + 1) - (a - 1) * cos_w0 - 2 * sqrt_a * alpha

    return np.array([b0, b1, b2]) / a0, np.array([a0, a1, a2]) / a0


def apply_warmth(audio: np.ndarray, sr: int, warmth_db: float) -> np.ndarray:
    """Positive warmth_db: gentle bass boost + treble cut. Negative: the reverse (brighter/thinner)."""
    if warmth_db == 0:
        return audio

    float_audio = audio.astype(np.float32)
    b_low, a_low = _shelf_coeffs(sr, 200.0, warmth_db, "low")
    float_audio = lfilter(b_low.astype(np.float32), a_low.astype(np.float32), float_audio)
    b_high, a_high = _shelf_coeffs(sr, 4000.0, -warmth_db, "high")
    float_audio = lfilter(b_high.astype(np.float32), a_high.astype(np.float32), float_audio)

    return _clip_to_dtype(float_audio, audio.dtype)


def _delayed_recursion(x: np.ndarray, delay: int, b: list[float], a: list[float]) -> np.ndarray:
    """Run a 2-tap recursion whose taps are `delay` samples apart, in O(N).

    A comb/allpass filter's difference equation only references n and n-delay,
    but handing scipy a dense (delay+1)-length coefficient array makes lfilter
    do O(N*delay) work -- ~950 multiplies per sample for a 43ms comb, which
    profiling showed was 94% of the entire effects pass. Reshaping the signal
    to (blocks, delay) makes sample n-delay the previous row of the same
    column, so the identical math becomes a first-order filter along axis 0.
    """
    n = len(x)
    n_blocks = -(-n // delay)  # ceil
    padded = np.zeros(n_blocks * delay, dtype=np.float32)
    padded[:n] = x
    filtered = lfilter(
        np.asarray(b, dtype=np.float32), np.asarray(a, dtype=np.float32),
        padded.reshape(n_blocks, delay), axis=0,
    )
    return filtered.reshape(-1)[:n]


def apply_reverb(audio: np.ndarray, sr: int, amount: float) -> np.ndarray:
    """Schroeder-style reverb (parallel combs + series allpass), dry/wet mixed by `amount` (0-1)."""
    amount = max(0.0, min(1.0, amount))
    if amount == 0 or len(audio) == 0:
        return audio

    dry = audio.astype(np.float32)
    comb_delays_ms = [29.7, 37.1, 41.1, 43.7]
    comb_gain = 0.77
    wet = np.zeros_like(dry)
    for delay_ms in comb_delays_ms:
        delay_samples = max(1, int(sr * delay_ms / 1000))
        # y[n] = x[n] + comb_gain * y[n - delay]
        wet += _delayed_recursion(dry, delay_samples, [1.0], [1.0, -comb_gain])
    wet /= len(comb_delays_ms)

    allpass_delay = max(1, int(sr * 5.0 / 1000))
    g = 0.7
    # y[n] = -g*x[n] + x[n - delay] + g*y[n - delay]
    wet = _delayed_recursion(wet, allpass_delay, [-g, 1.0], [1.0, -g])

    mixed = dry * (1 - amount) + wet * amount
    return _clip_to_dtype(mixed, audio.dtype)
