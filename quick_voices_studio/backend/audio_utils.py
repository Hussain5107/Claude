"""Text chunking and long-form audio generation for Quick Voices Studio.

Simpler than the main Zahra Studio pipeline on purpose: Piper voices are
fixed/pre-trained (no reference-audio conditioning), and Piper already
normalizes each chunk's peak level. Two paths:

- No pitch/warmth/reverb requested (the default): chunks are synthesized
  and streamed straight to disk, same as before -- fast, bounded memory.
- Any of pitch/warmth/reverb requested: chunks are buffered in memory so
  post_processing.py can run once over the whole thing, then written out.
  noise_scale/noise_w_scale (Piper's own expressiveness controls) are free
  either way -- they're applied per-chunk at synthesis time, not a separate
  pass.
"""

import re
import wave
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from . import post_processing, tts_engine
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


def _open_wav_writer(out_path: Path, sample_rate: int) -> wave.Wave_write:
    wav_file = wave.open(str(out_path), "wb")
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    return wav_file


def _generate_streamed(
    chunks: list[TextChunk],
    voice_code: str,
    length_scale: float,
    noise_scale: float | None,
    noise_w_scale: float | None,
    out_path: Path,
    on_progress: ProgressCallback | None,
) -> float:
    total_samples = 0
    sample_rate: int | None = None
    wav_file: wave.Wave_write | None = None
    try:
        for i, chunk in enumerate(chunks):
            samples, sr = tts_engine.synthesize_chunk(
                chunk.text, voice_code, length_scale, noise_scale, noise_w_scale
            )

            if wav_file is None:
                sample_rate = sr
                wav_file = _open_wav_writer(out_path, sr)

            wav_file.writeframes(samples.tobytes())
            total_samples += len(samples)

            if on_progress is not None:
                on_progress(i + 1, len(chunks))
    finally:
        if wav_file is not None:
            wav_file.close()

    return total_samples / sample_rate if sample_rate else 0.0


def _generate_buffered(
    chunks: list[TextChunk],
    voice_code: str,
    length_scale: float,
    noise_scale: float | None,
    noise_w_scale: float | None,
    pitch_semitones: float,
    warmth_db: float,
    reverb_amount: float,
    out_path: Path,
    on_progress: ProgressCallback | None,
) -> float:
    pieces: list[np.ndarray] = []
    sample_rate: int | None = None
    for i, chunk in enumerate(chunks):
        samples, sr = tts_engine.synthesize_chunk(
            chunk.text, voice_code, length_scale, noise_scale, noise_w_scale
        )
        sample_rate = sr
        pieces.append(samples)
        if on_progress is not None:
            on_progress(i + 1, len(chunks))

    audio = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.int16)
    pieces.clear()  # drop the per-chunk copies; only the concatenated buffer is needed now
    if pitch_semitones != 0:
        audio = post_processing.pitch_shift(audio, sample_rate, pitch_semitones)
    if warmth_db != 0:
        audio = post_processing.apply_warmth(audio, sample_rate, warmth_db)
    if reverb_amount > 0:
        audio = post_processing.apply_reverb(audio, sample_rate, reverb_amount)

    wav_file = _open_wav_writer(out_path, sample_rate)
    try:
        wav_file.writeframes(audio.tobytes())
    finally:
        wav_file.close()

    return len(audio) / sample_rate if sample_rate else 0.0


def generate_long_form(
    text: str,
    voice_code: str,
    out_path: Path,
    length_scale: float = 1.0,
    noise_scale: float | None = None,
    noise_w_scale: float | None = None,
    pitch_semitones: float = 0.0,
    warmth_db: float = 0.0,
    reverb_amount: float = 0.0,
    on_progress: ProgressCallback | None = None,
) -> float:
    """Generate speech for `text` in `voice_code`, writing PCM16 audio to `out_path`.

    Returns the resulting audio duration in seconds.
    """
    if not text or not text.strip():
        raise InvalidTextError("Script text is empty.")
    if len(text) > settings.max_text_chars:
        raise InvalidTextError(f"Script is too long ({len(text)} chars, max {settings.max_text_chars}).")

    chunks = chunk_text(text)
    if not chunks:
        raise InvalidTextError("Script contains no readable text.")

    needs_postprocess = pitch_semitones != 0 or warmth_db != 0 or reverb_amount > 0
    if not needs_postprocess:
        return _generate_streamed(
            chunks, voice_code, length_scale, noise_scale, noise_w_scale, out_path, on_progress
        )

    # pedalboard's PitchShift preserves duration (unlike a resample-based shift), so
    # length_scale needs no compensation here -- what you set is what you get.
    return _generate_buffered(
        chunks,
        voice_code,
        length_scale,
        noise_scale,
        noise_w_scale,
        pitch_semitones,
        warmth_db,
        reverb_amount,
        out_path,
        on_progress,
    )
