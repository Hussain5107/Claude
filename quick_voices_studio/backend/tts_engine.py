"""Loads and caches Piper voices, and runs synthesis.

Piper is a small, CPU-fast, non-cloning TTS engine (ONNX models, a few
hundred MB total for several voices) -- unlike Chatterbox in the main Zahra
Studio app, there's no multi-GB model, no reference-audio conditioning, and
no repetition-cutoff retry logic needed: each voice is a fixed, pre-trained
speaker.
"""

import logging
import threading
from pathlib import Path

import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig
from piper.download_voices import download_voice as _piper_download_voice

from .config import settings
from .exceptions import UnknownVoiceError, VoiceDownloadError
from .voice_catalog import get_voice

logger = logging.getLogger("quick_voices.tts_engine")

_voice_cache: dict[str, PiperVoice] = {}
_cache_lock = threading.Lock()


def is_voice_downloaded(code: str) -> bool:
    model_path = settings.voices_dir / f"{code}.onnx"
    config_path = settings.voices_dir / f"{code}.onnx.json"
    return model_path.exists() and config_path.exists()


def ensure_voice_downloaded(code: str) -> None:
    if is_voice_downloaded(code):
        return
    if get_voice(code) is None:
        raise UnknownVoiceError(f"'{code}' is not in the voice catalog.")
    logger.info("Downloading Piper voice '%s' (first use only)...", code)
    try:
        _piper_download_voice(code, settings.voices_dir)
    except Exception as exc:  # noqa: BLE001 - surface any download failure as a domain error
        raise VoiceDownloadError(f"Failed to download voice '{code}': {exc}") from exc


def get_model(code: str) -> PiperVoice:
    with _cache_lock:
        cached = _voice_cache.get(code)
        if cached is not None:
            return cached

    ensure_voice_downloaded(code)
    model_path = settings.voices_dir / f"{code}.onnx"

    with _cache_lock:
        cached = _voice_cache.get(code)
        if cached is not None:
            return cached
        voice = PiperVoice.load(model_path)
        _voice_cache[code] = voice
        return voice


def synthesize_chunk(
    text: str,
    code: str,
    length_scale: float,
    noise_scale: float | None = None,
    noise_w_scale: float | None = None,
) -> tuple[np.ndarray, int]:
    """Synthesize one chunk of text. Returns (int16 PCM samples, sample_rate).

    noise_scale/noise_w_scale are Piper's own expressiveness controls -- how
    much natural variation the model adds to pitch/timing -- applied for
    free at synthesis time, unlike pitch/warmth/reverb which are a separate
    post-processing pass over the finished audio (see post_processing.py).
    """
    voice = get_model(code)
    syn_config = SynthesisConfig(
        length_scale=length_scale, noise_scale=noise_scale, noise_w_scale=noise_w_scale
    )

    pieces = [chunk.audio_int16_array for chunk in voice.synthesize(text, syn_config=syn_config)]
    if not pieces:
        return np.zeros(0, dtype=np.int16), voice.config.sample_rate

    return np.concatenate(pieces), voice.config.sample_rate


def preload_voice_paths(code: str) -> tuple[Path, Path]:
    return settings.voices_dir / f"{code}.onnx", settings.voices_dir / f"{code}.onnx.json"
