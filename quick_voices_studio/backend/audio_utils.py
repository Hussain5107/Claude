"""Text chunking and long-form audio generation for Quick Voices Studio.

Simpler than the main Zahra Studio pipeline on purpose: Piper voices are
fixed/pre-trained (no reference-audio conditioning, no post-processing
needed -- Piper already normalizes each chunk's peak level), so this just
chunks text, synthesizes each chunk, and streams PCM16 frames straight to
disk.
"""

import re
import wave
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from . import tts_engine
from .config import settings
from .exceptions import InvalidTextError

ProgressCallback = Callable[[int, int], None]

_SENTENCE_SPLIT_PATTERN = re.compile(r"(?<=[.!?])\s+")


@dataclass
class TextChunk:
    text: str


def chunk_text(text: str, max_chars: int | None = None) -> list[TextChunk]:
    max_chars = max_chars or settings.chunk_max_chars
    chunks: list[TextChunk] = []

    for paragraph in text.split("\n\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        sentences = [s.strip() for s in _SENTENCE_SPLIT_PATTERN.split(paragraph) if s.strip()]
        current = ""
        for sentence in sentences:
            candidate = f"{current} {sentence}".strip() if current else sentence
            if len(candidate) > max_chars and current:
                chunks.append(TextChunk(current))
                current = sentence
            else:
                current = candidate
        if current:
            chunks.append(TextChunk(current))

    return chunks


def generate_long_form(
    text: str,
    voice_code: str,
    out_path: Path,
    length_scale: float = 1.0,
    on_progress: ProgressCallback | None = None,
) -> float:
    """Generate speech for `text` in `voice_code`, streaming PCM16 frames to `out_path`.

    Returns the resulting audio duration in seconds.
    """
    if not text or not text.strip():
        raise InvalidTextError("Script text is empty.")
    if len(text) > settings.max_text_chars:
        raise InvalidTextError(f"Script is too long ({len(text)} chars, max {settings.max_text_chars}).")

    chunks = chunk_text(text)
    if not chunks:
        raise InvalidTextError("Script contains no readable text.")

    total_samples = 0
    sample_rate: int | None = None
    wav_file: wave.Wave_write | None = None
    try:
        for i, chunk in enumerate(chunks):
            samples, sr = tts_engine.synthesize_chunk(chunk.text, voice_code, length_scale)

            if wav_file is None:
                sample_rate = sr
                wav_file = wave.open(str(out_path), "wb")
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sr)

            wav_file.writeframes(samples.tobytes())
            total_samples += len(samples)

            if on_progress is not None:
                on_progress(i + 1, len(chunks))
    finally:
        if wav_file is not None:
            wav_file.close()

    return total_samples / sample_rate if sample_rate else 0.0
