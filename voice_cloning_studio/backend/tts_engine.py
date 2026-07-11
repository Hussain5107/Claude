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

import contextlib
import logging
import threading

import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals

from .config import settings
from .exceptions import VoiceProcessingError
from .logging_config import get_logger

logger = get_logger(__name__)

_model: ChatterboxMultilingualTTS | None = None
_model_lock = threading.Lock()

_ALIGNMENT_LOGGER_NAME = "chatterbox.models.t3.inference.alignment_stream_analyzer"


class _RepetitionCutoffDetector(logging.Handler):
    """Watches for Chatterbox's own repetition-safety log line during one generate() call."""

    def __init__(self):
        super().__init__()
        self.triggered = False

    def emit(self, record: logging.LogRecord) -> None:
        if "forcing EOS token" in record.getMessage():
            self.triggered = True


@contextlib.contextmanager
def _watch_for_repetition_cutoff():
    detector = _RepetitionCutoffDetector()
    target = logging.getLogger(_ALIGNMENT_LOGGER_NAME)
    target.addHandler(detector)
    try:
        yield detector
    finally:
        target.removeHandler(detector)


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


def _generate_once(model, text, language_id, exaggeration, cfg_weight) -> tuple[torch.Tensor, bool]:
    with _watch_for_repetition_cutoff() as detector:
        wav = model.generate(
            text,
            language_id=language_id,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
    return wav.squeeze(0), detector.triggered


def generate_chunk(
    text: str,
    conditionals: Conditionals,
    language_id: str = "en",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
) -> tuple[torch.Tensor, int, bool]:
    """Generates one chunk, auto-retrying (up to ``max_chunk_retries`` times) if
    Chatterbox's own repetition-safety mechanism cut the result short -- sampling
    is stochastic, so a retry often produces a clean, complete result.

    Returns (audio, sample_rate, still_truncated_after_retries).
    """
    model = get_model()
    model.conds = conditionals
    try:
        wav, truncated = _generate_once(model, text, language_id, exaggeration, cfg_weight)
        attempts = 1
        while truncated and attempts <= settings.max_chunk_retries:
            logger.info("Chunk hit repetition cutoff, retrying (attempt %d)...", attempts + 1)
            wav, truncated = _generate_once(model, text, language_id, exaggeration, cfg_weight)
            attempts += 1
    except Exception as e:
        logger.exception("Generation failed for chunk (len=%d chars)", len(text))
        raise VoiceProcessingError(e) from e

    if truncated:
        logger.warning("Chunk still truncated after %d attempt(s), keeping best result", attempts)
    return wav, model.sr, truncated
