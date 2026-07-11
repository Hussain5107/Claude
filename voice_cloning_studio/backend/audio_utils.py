import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
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


@dataclass
class CaptionCue:
    start: float
    end: float
    text: str


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
) -> tuple[torch.Tensor, int, list[CaptionCue]]:
    """Generates narration for arbitrarily long text.

    Chunks the text (the underlying model can only generate a limited amount
    of audio per call), loads the voice embedding once, and reuses it across
    all chunks -- reloading it from disk per chunk was a measured, avoidable
    cost. Calls ``on_progress(done, total)`` after each chunk if provided.

    Returns the final audio, its sample rate, and caption cues timed against
    that audio (accurate, since they're built from the real generated chunk
    durations rather than guessed from text length).
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
    cues: list[CaptionCue] = []
    cumulative_sec = 0.0
    sample_rate = None
    truncated_count = 0

    for i, chunk in enumerate(chunks):
        wav, sample_rate, truncated = tts_engine.generate_chunk(
            chunk.text,
            conditionals,
            language_id=language_id,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
        if truncated:
            truncated_count += 1
        pieces.append(wav)

        chunk_duration = wav.shape[-1] / sample_rate
        cues.append(CaptionCue(start=cumulative_sec, end=cumulative_sec + chunk_duration, text=chunk.text))
        cumulative_sec += chunk_duration

        gap_sec = (
            settings.chunk_gap_paragraph_sec if chunk.is_paragraph_end else settings.chunk_gap_sentence_sec
        )
        pieces.append(torch.zeros(int(gap_sec * sample_rate)))
        cumulative_sec += gap_sec

        if on_progress:
            on_progress(i + 1, len(chunks))

    if truncated_count:
        logger.warning(
            "%d/%d chunk(s) hit the repetition cutoff even after retries", truncated_count, len(chunks)
        )

    audio = torch.cat(pieces)

    if settings.enable_silence_trim:
        audio, trimmed_start_sec = _trim_silence(audio, sample_rate, settings.silence_trim_threshold_db)
        final_duration = audio.shape[-1] / sample_rate
        for cue in cues:
            cue.start = max(0.0, cue.start - trimmed_start_sec)
            cue.end = max(0.0, min(cue.end - trimmed_start_sec, final_duration))

    if settings.enable_loudness_normalization:
        audio = _normalize_loudness(audio, sample_rate, settings.target_lufs)

    return audio, sample_rate, cues


def _trim_silence(samples: torch.Tensor, sample_rate: int, threshold_db: float) -> tuple[torch.Tensor, float]:
    """Trims leading/trailing near-silence from the whole track (not between chunks --
    those gaps are intentional pauses). Returns the trimmed audio and how many
    seconds were cut from the start, so callers can shift caption timestamps."""
    if samples.numel() == 0:
        return samples, 0.0

    threshold = 10 ** (threshold_db / 20)
    above = (samples.abs() > threshold).nonzero(as_tuple=True)[0]
    if above.numel() == 0:
        return samples, 0.0

    pad = int(0.05 * sample_rate)
    start = max(int(above[0]) - pad, 0)
    end = min(int(above[-1]) + pad, samples.numel())
    return samples[start:end], start / sample_rate


def _normalize_loudness(samples: torch.Tensor, sample_rate: int, target_lufs: float) -> torch.Tensor:
    if samples.numel() == 0:
        return samples
    audio_np = samples.numpy().astype(np.float64)
    meter = pyln.Meter(sample_rate)
    try:
        loudness = meter.integrated_loudness(audio_np)
    except Exception:
        logger.warning("Could not measure loudness (likely near-silent audio), skipping normalization")
        return samples
    if loudness == float("-inf"):
        return samples

    normalized = pyln.normalize.loudness(audio_np, loudness, target_lufs)
    normalized = np.clip(normalized, -1.0, 1.0)
    return torch.from_numpy(normalized.astype(np.float32))


def save_wav(samples: torch.Tensor, sample_rate: int, path: Path) -> None:
    torchaudio.save(str(path), samples.unsqueeze(0), sample_rate)
    logger.info("Saved %s (%.1fs of audio)", path, samples.shape[-1] / sample_rate)


def _format_srt_timestamp(seconds: float) -> str:
    millis = int(round(max(seconds, 0.0) * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def write_srt(cues: list[CaptionCue], path: Path) -> None:
    lines = []
    for i, cue in enumerate(cues, start=1):
        lines.append(str(i))
        lines.append(f"{_format_srt_timestamp(cue.start)} --> {_format_srt_timestamp(cue.end)}")
        lines.append(cue.text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Saved %s (%d caption cues)", path, len(cues))
