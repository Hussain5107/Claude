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
"""

import numpy as np
from scipy.signal import lfilter


def pitch_shift(audio: np.ndarray, semitones: float) -> np.ndarray:
    """Resample-based pitch shift. Assumes the caller has already compensated
    Piper's length_scale so the result comes back near the original duration."""
    if semitones == 0 or len(audio) == 0:
        return audio

    ratio = 2.0 ** (semitones / 12.0)
    new_length = max(1, int(round(len(audio) / ratio)))
    old_indices = np.arange(len(audio), dtype=np.float64)
    new_indices = np.linspace(0, len(audio) - 1, new_length)
    return np.interp(new_indices, old_indices, audio).astype(audio.dtype)


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

    float_audio = audio.astype(np.float64)
    b_low, a_low = _shelf_coeffs(sr, 200.0, warmth_db, "low")
    float_audio = lfilter(b_low, a_low, float_audio)
    b_high, a_high = _shelf_coeffs(sr, 4000.0, -warmth_db, "high")
    float_audio = lfilter(b_high, a_high, float_audio)

    max_val = np.iinfo(audio.dtype).max if np.issubdtype(audio.dtype, np.integer) else 1.0
    return np.clip(float_audio, -max_val - 1, max_val).astype(audio.dtype)


def apply_reverb(audio: np.ndarray, sr: int, amount: float) -> np.ndarray:
    """Schroeder-style reverb (parallel combs + series allpass), dry/wet mixed by `amount` (0-1)."""
    amount = max(0.0, min(1.0, amount))
    if amount == 0 or len(audio) == 0:
        return audio

    dry = audio.astype(np.float64)
    comb_delays_ms = [29.7, 37.1, 41.1, 43.7]
    comb_gain = 0.77
    wet = np.zeros_like(dry)
    for delay_ms in comb_delays_ms:
        delay_samples = max(1, int(sr * delay_ms / 1000))
        a = np.zeros(delay_samples + 1)
        a[0] = 1.0
        a[-1] = -comb_gain
        wet += lfilter([1.0], a, dry)
    wet /= len(comb_delays_ms)

    allpass_delay = max(1, int(sr * 5.0 / 1000))
    g = 0.7
    b_ap = np.zeros(allpass_delay + 1)
    b_ap[0], b_ap[-1] = -g, 1.0
    a_ap = np.zeros(allpass_delay + 1)
    a_ap[0], a_ap[-1] = 1.0, -g
    wet = lfilter(b_ap, a_ap, wet)

    mixed = dry * (1 - amount) + wet * amount
    max_val = np.iinfo(audio.dtype).max if np.issubdtype(audio.dtype, np.integer) else 1.0
    return np.clip(mixed, -max_val - 1, max_val).astype(audio.dtype)
