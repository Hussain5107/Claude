"""Wraps Chatterbox Multilingual (MIT licensed) as the TTS engine.

Loads once as a process-wide singleton (model load is expensive: several GB
of weights). Cloning a voice computes conditioning ("speaker embedding")
from a reference clip and saves it to disk via Chatterbox's own
Conditionals.save/load, so generation later doesn't need to touch the
original audio file again.

Performance note: loading a saved embedding from disk (``Conditionals.load``)
deserializes a torch checkpoint and is not free. Callers generating a long
script in many chunks should load it once per job with ``load_conditionals``
and reuse it via ``generate_chunk``, rather than reloading per chunk.
"""

import threading

import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals

from .config import settings
from .exceptions import VoiceProcessingError
from .logging_config import get_logger

logger = get_logger(__name__)

_model: ChatterboxMultilingualTTS | None = None
_model_lock = threading.Lock()


def get_device() -> str:
    if settings.device_override:
        return settings.device_override
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_model() -> ChatterboxMultilingualTTS:
    """Returns the process-wide model singleton, loading it on first call.

    Thread-safe: generation jobs run on a background worker thread, so two
    requests racing to trigger the (slow) first load must not both start it.
    """
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            device = get_device()
            torch.set_num_threads(settings.torch_num_threads)
            logger.info("Loading Chatterbox Multilingual on device=%s (torch_num_threads=%d)...",
                        device, settings.torch_num_threads)
            try:
                _model = ChatterboxMultilingualTTS.from_pretrained(device=device)
            except Exception as e:
                logger.exception("Failed to load Chatterbox model")
                raise VoiceProcessingError(e) from e
            logger.info("Model loaded.")
    return _model


def get_supported_languages() -> dict:
    return ChatterboxMultilingualTTS.get_supported_languages()


def extract_and_save_embedding(audio_path: str, embedding_path: str, exaggeration: float = 0.5) -> None:
    model = get_model()
    try:
        model.prepare_conditionals(audio_path, exaggeration=exaggeration)
        model.conds.save(embedding_path)
    except Exception as e:
        logger.exception("Failed to extract voice embedding from %s", audio_path)
        raise VoiceProcessingError(e) from e


def load_conditionals(embedding_path: str) -> Conditionals:
    model = get_model()
    try:
        return Conditionals.load(embedding_path, map_location=model.device).to(model.device)
    except Exception as e:
        logger.exception("Failed to load voice embedding from %s", embedding_path)
        raise VoiceProcessingError(e) from e


def generate_chunk(
    text: str,
    conditionals: Conditionals,
    language_id: str = "en",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
) -> tuple[torch.Tensor, int]:
    model = get_model()
    model.conds = conditionals
    try:
        wav = model.generate(
            text,
            language_id=language_id,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
    except Exception as e:
        logger.exception("Generation failed for chunk (len=%d chars)", len(text))
        raise VoiceProcessingError(e) from e
    return wav.squeeze(0), model.sr
