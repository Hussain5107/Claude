import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import torch
import torchaudio

from . import tts_engine
from .config import settings
from .exceptions import InvalidTextError
from .logging_config import get_logger

logger = get_logger(__name__)

ProgressCallback = Callable[[int, int], None]


@dataclass
class TextChunk:
    text: str
    is_paragraph_end: bool


def chunk_text(text: str, max_chars: int | None = None) -> list[TextChunk]:
    max_chars = max_chars or settings.chunk_max_chars
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[TextChunk] = []
    for para in paragraphs:
        sentences = re.findall(r"[^.!?]+[.!?]*\s*", para) or [para]
        current = ""
        para_chunks: list[str] = []
        for sentence in sentences:
            if len(current) + len(sentence) > max_chars and current:
                para_chunks.append(current.strip())
                current = sentence
            else:
                current += sentence
        if current.strip():
            para_chunks.append(current.strip())

        for j, chunk in enumerate(para_chunks):
            chunks.append(TextChunk(text=chunk, is_paragraph_end=j == len(para_chunks) - 1))
    return chunks


def generate_long_form(
    text: str,
    embedding_path: str,
    language_id: str = "en",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    on_progress: ProgressCallback | None = None,
) -> tuple[torch.Tensor, int]:
    """Generates narration for arbitrarily long text.

    Chunks the text (the underlying model can only generate a limited amount
    of audio per call), loads the voice embedding once, and reuses it across
    all chunks -- reloading it from disk per chunk was a measured, avoidable
    cost. Calls ``on_progress(done, total)`` after each chunk if provided.
    """
    if len(text) > settings.max_text_chars:
        raise InvalidTextError(
            f"Script is {len(text)} characters, which exceeds the limit of "
            f"{settings.max_text_chars}. Split it into multiple generations."
        )

    chunks = chunk_text(text)
    if not chunks:
        raise InvalidTextError("No text to synthesize")

    logger.info("Generating %d chunk(s) for a %d-character script", len(chunks), len(text))
    conditionals = tts_engine.load_conditionals(embedding_path)

    pieces = []
    sample_rate = None
    for i, chunk in enumerate(chunks):
        wav, sample_rate = tts_engine.generate_chunk(
            chunk.text,
            conditionals,
            language_id=language_id,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
        pieces.append(wav)

        gap_sec = (
            settings.chunk_gap_paragraph_sec if chunk.is_paragraph_end else settings.chunk_gap_sentence_sec
        )
        pieces.append(torch.zeros(int(gap_sec * sample_rate)))

        if on_progress:
            on_progress(i + 1, len(chunks))

    return torch.cat(pieces), sample_rate


def save_wav(samples: torch.Tensor, sample_rate: int, path: Path) -> None:
    torchaudio.save(str(path), samples.unsqueeze(0), sample_rate)
    logger.info("Saved %s (%.1fs of audio)", path, samples.shape[-1] / sample_rate)
