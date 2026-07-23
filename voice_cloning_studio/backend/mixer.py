"""Mixes a narration track with background music: loop/trim to length, fades,
volume control per track, and optional ducking (auto-lowering music under
the voice, restoring it in pauses).

Uses `soundfile` to decode uploads (WAV/MP3/FLAC/OGG -- no ffmpeg required,
unlike Chatterbox's own reference-clip loader) and `pedalboard.Resample` to
match sample rates. Runs synchronously: this is single-pass DSP with no
model inference, fast enough (seconds, not minutes, even for an hour of
audio) that it doesn't need the background job/polling machinery generation
uses.
"""

from pathlib import Path

import numpy as np
import soundfile as sf
from pedalboard import Resample

from .exceptions import InvalidAudioError
from .logging_config import get_logger

logger = get_logger(__name__)

MIXER_ALLOWED_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg")


def load_audio_file(path: Path) -> tuple[np.ndarray, int]:
    """Loads an audio file as mono float32. Raises InvalidAudioError on
    anything soundfile can't decode (e.g. a .m4a slipped past validation)."""
    try:
        samples, sr = sf.read(str(path), dtype="float32", always_2d=False)
    except Exception as e:  # noqa: BLE001 - surfaced as a clear domain error
        raise InvalidAudioError(f"Could not read audio file '{path.name}': {e}") from e

    if samples.ndim > 1:
        samples = samples.mean(axis=1)  # downmix to mono for a consistent pipeline
    return samples.astype(np.float32), sr


def _resample(samples: np.ndarray, from_sr: int, to_sr: int) -> np.ndarray:
    if from_sr == to_sr:
        return samples
    board_resample = Resample(target_sample_rate=to_sr)
    return board_resample(samples, from_sr)


def _db_to_linear(db: float) -> float:
    return 10 ** (db / 20)


def apply_gain(samples: np.ndarray, gain_db: float) -> np.ndarray:
    if gain_db == 0:
        return samples
    return samples * _db_to_linear(gain_db)


def _crossfade_loop(music: np.ndarray, target_len: int, sr: int, crossfade_sec: float = 0.5) -> np.ndarray:
    """Repeats `music` to reach target_len, crossfading each loop seam so it
    doesn't click/jump. If music is already >= target_len, just trims."""
    if len(music) >= target_len:
        return music[:target_len]
    if len(music) == 0:
        return np.zeros(target_len, dtype=np.float32)

    crossfade_samples = min(int(crossfade_sec * sr), len(music) // 2)
    out = music.copy()
    while len(out) < target_len:
        if crossfade_samples > 0:
            fade_out = np.linspace(1.0, 0.0, crossfade_samples, dtype=np.float32)
            fade_in = np.linspace(0.0, 1.0, crossfade_samples, dtype=np.float32)
            tail = out[-crossfade_samples:] * fade_out
            head = music[:crossfade_samples] * fade_in
            blended = tail + head
            out = np.concatenate([out[:-crossfade_samples], blended, music[crossfade_samples:]])
        else:
            out = np.concatenate([out, music])
    return out[:target_len]


def loop_or_trim_to_length(music: np.ndarray, target_len: int, sr: int, loop: bool) -> np.ndarray:
    if len(music) >= target_len:
        return music[:target_len]
    if loop:
        return _crossfade_loop(music, target_len, sr)
    padded = np.zeros(target_len, dtype=np.float32)
    padded[: len(music)] = music
    return padded


def apply_fade(samples: np.ndarray, sr: int, fade_in_sec: float, fade_out_sec: float) -> np.ndarray:
    samples = samples.copy()
    fade_in_n = min(int(fade_in_sec * sr), len(samples))
    fade_out_n = min(int(fade_out_sec * sr), len(samples))
    if fade_in_n > 0:
        samples[:fade_in_n] *= np.linspace(0.0, 1.0, fade_in_n, dtype=np.float32)
    if fade_out_n > 0:
        samples[-fade_out_n:] *= np.linspace(1.0, 0.0, fade_out_n, dtype=np.float32)
    return samples


def compute_voice_activity_envelope(
    voice: np.ndarray, sr: int, threshold_db: float = -35.0, smooth_sec: float = 0.15
) -> np.ndarray:
    """A 0-1 envelope: ~1 where the voice is speaking, ~0 during pauses,
    smoothed so ducking transitions aren't choppy."""
    window = max(1, int(0.02 * sr))  # 20ms analysis window
    n_windows = max(1, len(voice) // window)
    rms = np.array(
        [np.sqrt(np.mean(voice[i * window:(i + 1) * window] ** 2) + 1e-12) for i in range(n_windows)],
        dtype=np.float32,
    )
    rms_db = 20 * np.log10(np.maximum(rms, 1e-8))
    active = (rms_db > threshold_db).astype(np.float32)

    # exponential smoothing (attack/release) so the envelope ramps instead of switching instantly
    smooth_windows = max(1, int(smooth_sec * sr / window))
    alpha = 1.0 / smooth_windows
    smoothed = np.zeros_like(active)
    level = 0.0
    for i, v in enumerate(active):
        level += alpha * (v - level)
        smoothed[i] = level

    return np.repeat(smoothed, window)[: len(voice)]


def duck_music(music: np.ndarray, voice: np.ndarray, sr: int, duck_db: float) -> np.ndarray:
    """Attenuates `music` by up to duck_db wherever `voice` is active."""
    if duck_db == 0:
        return music
    envelope = compute_voice_activity_envelope(voice, sr)
    if len(envelope) < len(music):
        envelope = np.pad(envelope, (0, len(music) - len(envelope)))
    else:
        envelope = envelope[: len(music)]

    duck_factor = _db_to_linear(-abs(duck_db))
    gain = 1.0 - envelope * (1.0 - duck_factor)  # 1.0 when silent, duck_factor when voice active
    return music * gain


def mix_audio(
    voice_path: Path,
    music_path: Path,
    out_path: Path,
    voice_gain_db: float = 0.0,
    music_gain_db: float = -15.0,
    fade_in_sec: float = 2.0,
    fade_out_sec: float = 3.0,
    loop_music: bool = True,
    duck_db: float = 0.0,
) -> float:
    """Mixes voice_path + music_path, writes the result to out_path (WAV).
    Returns the output duration in seconds."""
    voice, voice_sr = load_audio_file(voice_path)
    music, music_sr = load_audio_file(music_path)

    music = _resample(music, music_sr, voice_sr)
    sr = voice_sr

    music = loop_or_trim_to_length(music, len(voice), sr, loop_music)
    music = apply_fade(music, sr, fade_in_sec, fade_out_sec)
    music = apply_gain(music, music_gain_db)
    music = duck_music(music, voice, sr, duck_db)

    voice = apply_gain(voice, voice_gain_db)

    mixed = voice + music
    peak = np.abs(mixed).max()
    if peak > 1.0:
        mixed = mixed / peak  # scale down to avoid clipping, preserving relative balance

    sf.write(str(out_path), mixed, sr, subtype="PCM_16")
    duration = len(mixed) / sr
    logger.info("Mixed %s + %s -> %s (%.1fs)", voice_path.name, music_path.name, out_path.name, duration)
    return duration
