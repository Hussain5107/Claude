"""Optional 'studio' audio post-processing: pitch, warmth (EQ), reverb.

Piper itself has no expression controls beyond noise_scale/noise_w_scale
(handled in tts_engine.py, at synthesis time -- free, no extra pass over the
audio). Everything here runs once on the finished buffer.

Built on Spotify's `pedalboard` (C++ audio DSP, thin Python wrapper) rather
than hand-rolled scipy filters: it's faster, better-tested, and its
PitchShift is a genuine formant-preserving shift, not the resample-based
"helium/deep voice" trick an earlier version of this file used as a speed
compromise -- pedalboard processes 10 minutes of audio in ~9s, fast enough
that there's no longer a reason to trade quality for speed here. (For
comparison, librosa's phase-vocoder pitch shift took ~19s for just 30s of
audio in testing -- pedalboard is a different tool, not just a faster
config of the same one.)
"""

import numpy as np
from pedalboard import HighShelfFilter, LowShelfFilter, Pedalboard, PitchShift, Reverb


def _to_float32(audio: np.ndarray) -> np.ndarray:
    if np.issubdtype(audio.dtype, np.integer):
        max_val = np.iinfo(audio.dtype).max
        return (audio.astype(np.float32) / max_val).clip(-1.0, 1.0)
    return audio.astype(np.float32)


def _from_float32(float_audio: np.ndarray, dtype: np.dtype) -> np.ndarray:
    if np.issubdtype(dtype, np.integer):
        max_val = np.iinfo(dtype).max
        return np.clip(float_audio * max_val, -max_val - 1, max_val).astype(dtype)
    return float_audio.astype(dtype)


def pitch_shift(audio: np.ndarray, sr: int, semitones: float) -> np.ndarray:
    """Formant-preserving pitch shift -- duration is unchanged, unlike a
    resample-based shift, so callers don't need to compensate length_scale."""
    if semitones == 0 or len(audio) == 0:
        return audio

    board = Pedalboard([PitchShift(semitones=semitones)])
    shifted = board(_to_float32(audio), sr)
    return _from_float32(shifted, audio.dtype)


def apply_warmth(audio: np.ndarray, sr: int, warmth_db: float) -> np.ndarray:
    """Positive warmth_db: gentle bass boost + treble cut. Negative: the reverse (brighter/thinner)."""
    if warmth_db == 0 or len(audio) == 0:
        return audio

    board = Pedalboard([
        LowShelfFilter(cutoff_frequency_hz=200.0, gain_db=warmth_db),
        HighShelfFilter(cutoff_frequency_hz=4000.0, gain_db=-warmth_db),
    ])
    warmed = board(_to_float32(audio), sr)
    return _from_float32(warmed, audio.dtype)


def apply_reverb(audio: np.ndarray, sr: int, amount: float) -> np.ndarray:
    """Room-presence reverb, dry/wet mixed by `amount` (0-1)."""
    amount = max(0.0, min(1.0, amount))
    if amount == 0 or len(audio) == 0:
        return audio

    board = Pedalboard([
        Reverb(room_size=0.4, damping=0.5, wet_level=amount, dry_level=1.0 - amount, width=1.0)
    ])
    wet = board(_to_float32(audio), sr)
    return _from_float32(wet, audio.dtype)
