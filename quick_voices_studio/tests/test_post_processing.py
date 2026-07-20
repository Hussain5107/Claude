"""Real numeric checks for the DSP in post_processing.py -- these run actual
pedalboard/numpy signal math (nothing here is mocked), same philosophy as the
main Zahra Studio app's audio tests: post-processing correctness can't be
verified by a mock, only by checking the math.
"""

import numpy as np
import pytest

from backend import post_processing

SR = 22050


def _sine(freq: float, seconds: float = 1.0, sr: int = SR) -> np.ndarray:
    t = np.arange(int(sr * seconds)) / sr
    return (np.sin(2 * np.pi * freq * t) * 10000).astype(np.int16)


def _harmonic_tone(f0: float, seconds: float = 2.0, sr: int = SR, n_harmonics: int = 6) -> np.ndarray:
    """A fundamental + harmonics plus a faint noise floor, standing in for voiced
    speech -- real speech is never a pure tone, and never perfectly periodic
    either. Pitch-shift accuracy is checked against this, not _sine: a
    phase-vocoder's phase-coherence has nothing to lock onto in a perfectly
    periodic signal, which makes exact-octave shifts on one a measurable but
    pathological artifact (confirmed directly: a noise-free version of this
    same harmonic signal still showed an ~8% error at -12 semitones, while
    adding a noise floor as faint as 2% resolved it to <1%) that doesn't
    reflect how the algorithm behaves on anything actually recorded."""
    t = np.arange(int(sr * seconds)) / sr
    sig = np.zeros_like(t)
    for h in range(1, n_harmonics + 1):
        sig += (1.0 / h) * np.sin(2 * np.pi * f0 * h * t)
    sig += 0.02 * np.random.default_rng(0).standard_normal(len(t))
    sig = sig / np.abs(sig).max() * 0.8
    return (sig * 32767).astype(np.int16)


def _dominant_freq(x: np.ndarray, sr: int = SR) -> float:
    spec = np.abs(np.fft.rfft(x.astype(np.float64)))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    return freqs[np.argmax(spec)]


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x.astype(np.float64) ** 2)))


def test_pitch_shift_zero_semitones_is_a_noop():
    audio = _sine(440)
    assert np.array_equal(post_processing.pitch_shift(audio, SR, 0.0), audio)


def test_pitch_shift_up_doubles_frequency_and_preserves_duration():
    audio = _sine(440, seconds=2.0)
    shifted = post_processing.pitch_shift(audio, SR, 12.0)

    assert shifted.dtype == audio.dtype
    assert len(shifted) == len(audio)  # pedalboard's PitchShift is formant-preserving
    assert _dominant_freq(shifted) == pytest.approx(880.0, rel=0.02)


def test_pitch_shift_down_halves_fundamental_and_preserves_duration():
    audio = _harmonic_tone(150.0)
    shifted = post_processing.pitch_shift(audio, SR, -12.0)

    assert len(shifted) == len(audio)
    # search near the expected fundamental rather than the global peak -- a
    # harmonic-rich signal has energy at multiple partials
    spec = np.abs(np.fft.rfft(shifted.astype(np.float64)))
    freqs = np.fft.rfftfreq(len(shifted), 1 / SR)
    mask = (freqs > 50) & (freqs < 110)
    f0 = freqs[mask][np.argmax(spec[mask])]
    assert f0 == pytest.approx(75.0, rel=0.02)


def test_pitch_shift_empty_audio_is_safe():
    assert len(post_processing.pitch_shift(np.zeros(0, dtype=np.int16), SR, 5.0)) == 0


def test_pitch_shift_stays_in_int16_range():
    audio = _sine(440, seconds=1.0)
    shifted = post_processing.pitch_shift(audio, SR, 7.0)
    assert shifted.dtype == np.int16
    assert np.abs(shifted).max() <= 32767


def test_apply_warmth_zero_is_a_noop():
    audio = _sine(440)
    assert np.array_equal(post_processing.apply_warmth(audio, SR, 0.0), audio)


def test_apply_warmth_positive_boosts_bass_and_cuts_treble():
    low_tone = _sine(100, seconds=2.0)
    high_tone = _sine(6000, seconds=2.0)

    warm_low = post_processing.apply_warmth(low_tone, SR, 6.0)
    warm_high = post_processing.apply_warmth(high_tone, SR, 6.0)

    assert _rms(warm_low) > _rms(low_tone)  # bass boosted
    assert _rms(warm_high) < _rms(high_tone)  # treble cut


def test_apply_warmth_negative_is_the_opposite():
    low_tone = _sine(100, seconds=2.0)
    high_tone = _sine(6000, seconds=2.0)

    bright_low = post_processing.apply_warmth(low_tone, SR, -6.0)
    bright_high = post_processing.apply_warmth(high_tone, SR, -6.0)

    assert _rms(bright_low) < _rms(low_tone)  # bass cut
    assert _rms(bright_high) > _rms(high_tone)  # treble boosted


def test_apply_reverb_zero_amount_is_a_noop():
    audio = _sine(440)
    assert np.array_equal(post_processing.apply_reverb(audio, SR, 0.0), audio)


def test_apply_reverb_adds_energy_after_input_stops():
    burst = np.zeros(SR, dtype=np.int16)
    burst[:1000] = _sine(440, seconds=1000 / SR)

    reverbed = post_processing.apply_reverb(burst, SR, 0.8)

    tail_original = np.abs(burst[1000:2000]).mean()
    tail_reverbed = np.abs(reverbed[1000:2000]).mean()
    assert tail_original == 0
    assert tail_reverbed > 0


def test_apply_reverb_stays_in_int16_range():
    audio = _sine(440, seconds=1.0)
    reverbed = post_processing.apply_reverb(audio, SR, 1.0)
    assert reverbed.dtype == np.int16
    assert np.abs(reverbed).max() <= 32767
    assert not np.isnan(reverbed.astype(np.float64)).any()
