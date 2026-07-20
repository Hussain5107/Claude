import re
import wave
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import torch

from . import job_store, tts_engine
from .config import settings
from .exceptions import InvalidTextError
from .logging_config import get_logger
from .profiling import PipelineProfile, stage_timer

logger = get_logger(__name__)

ProgressCallback = Callable[[int, int], None]


@dataclass
class TextChunk:
    text: str
    is_paragraph_end: bool
    language_id: str = "en"


@dataclass
class CaptionCue:
    start: float
    end: float
    text: str


LANGUAGE_TAG_PATTERN = re.compile(r"\[(\w{2})\](.*?)\[/\1\]", re.IGNORECASE | re.DOTALL)


def strip_language_tags(text: str) -> str:
    """Removes [xx]...[/xx] markup, leaving just the spoken text -- for word
    counts/estimates where the tags themselves shouldn't be counted."""
    return LANGUAGE_TAG_PATTERN.sub(lambda m: m.group(2), text)


def parse_language_segments(text: str, default_language: str) -> list[tuple[str, str]]:
    """Splits a script on inline [en]...[/en] / [fr]...[/fr] / [es]...[/es] tags for
    mixed-language scripts. Untagged text uses default_language. Returns
    (language_id, text) segments in original order; a script with no tags at
    all returns a single segment, unchanged from before this feature existed."""
    segments: list[tuple[str, str]] = []
    pos = 0
    for match in LANGUAGE_TAG_PATTERN.finditer(text):
        if match.start() > pos:
            preceding = text[pos:match.start()]
            if preceding.strip():
                segments.append((default_language, preceding))
        lang = match.group(1).lower()
        inner = match.group(2)
        if inner.strip():
            segments.append((lang, inner))
        pos = match.end()
    if pos < len(text):
        trailing = text[pos:]
        if trailing.strip():
            segments.append((default_language, trailing))
    if not segments:
        segments = [(default_language, text)]
    return segments


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


def chunk_text_with_languages(
    text: str, default_language: str, max_chars: int | None = None
) -> list[TextChunk]:
    """Like chunk_text, but resolves [xx]...[/xx] language tags first and
    stamps each resulting chunk with the language it should be spoken in."""
    chunks: list[TextChunk] = []
    for language_id, segment in parse_language_segments(text, default_language):
        segment_chunks = chunk_text(segment, max_chars)
        for chunk in segment_chunks:
            chunk.language_id = language_id
        chunks.extend(segment_chunks)
    return chunks


def _open_wav_writer(path: Path, sample_rate: int) -> wave.Wave_write:
    writer = wave.open(str(path), "wb")
    writer.setnchannels(1)
    writer.setsampwidth(2)  # 16-bit PCM
    writer.setframerate(sample_rate)
    return writer


def _write_pcm16(writer: wave.Wave_write, samples: torch.Tensor) -> None:
    clamped = samples.clamp(-1.0, 1.0)
    int16 = (clamped * 32767.0).to(torch.int16)
    writer.writeframes(int16.numpy().tobytes())


def _read_pcm16_wav(path: Path) -> tuple[torch.Tensor, int]:
    """Reads back a WAV written by _write_pcm16, without going through
    torchaudio.load -- recent torchaudio versions route .load() through an
    optional torchcodec backend that may not be installed, but since we
    fully control the format we wrote, stdlib `wave` reads it back directly."""
    with wave.open(str(path), "rb") as reader:
        sample_rate = reader.getframerate()
        raw = reader.readframes(reader.getnframes())
    int16 = np.frombuffer(raw, dtype=np.int16)
    samples = torch.from_numpy(int16.astype(np.float32) / 32767.0)
    return samples, sample_rate


def generate_long_form(
    text: str,
    embedding_path: str,
    out_path: Path,
    language_id: str = "en",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    on_progress: ProgressCallback | None = None,
    profile: PipelineProfile | None = None,
    job_id: str | None = None,
    precomputed_chunks: list[TextChunk] | None = None,
) -> list[CaptionCue]:
    """Generates narration for arbitrarily long text, writing it to out_path.

    If ``job_id`` is given, each chunk's finished audio is saved to that job's
    on-disk cache as soon as it's generated, and any chunk already cached
    there (from a previous, interrupted attempt at the same job_id) is loaded
    back instead of regenerated -- this is what makes resuming a crashed or
    failed job pick up from where it left off rather than starting over.
    ``precomputed_chunks``, if given, is used as-is instead of re-chunking
    ``text`` -- the resume path uses this so a resumed job always regenerates
    the exact same chunks as the original attempt, immune to any chunking
    settings that may have changed since.

    Chunks the text (the underlying model can only generate a limited amount
    of audio per call) and loads the voice embedding once, reusing it across
    all chunks.

    Two write strategies, chosen based on whether post-processing is needed:

    - No post-processing (silence trim / loudness normalization both off):
      chunks stream directly to out_path as they're generated, bounding
      memory to roughly one chunk at a time regardless of script length.
      Measured with benchmark_pipeline.py: this is a clear win over
      buffering everything in a list and concatenating once at the end.

    - Post-processing enabled (the default): loudness normalization
      inherently needs to see the whole signal, so a full in-memory view is
      unavoidable at that point regardless of write strategy. An earlier
      version of this function streamed to a temp file and read it back for
      this case too -- benchmarking that (see benchmark_pipeline.py) showed
      it was actually *worse*: the disk round-trip plus an extra float32 ->
      int16 -> float32 -> float64 conversion chain cost more memory and
      time than just keeping chunks as in-memory tensors and concatenating
      once, which is what this case does instead.

    Calls ``on_progress(done, total)`` after each chunk. If ``profile`` is
    given, per-stage timings are recorded into it.

    Mixed-language scripts: wrap a section in [xx]...[/xx] (e.g. [fr]Bonjour[/fr])
    to speak it in a different language than the rest -- untagged text uses
    ``language_id``. Each tagged language must be one of Chatterbox's
    supported languages (get_supported_languages()); an unsupported tag
    surfaces as a clear error from the model itself when that chunk generates.

    Returns caption cues timed against the actual final audio.
    """
    if len(text) > settings.max_text_chars:
        raise InvalidTextError(
            f"Script is {len(text)} characters, which exceeds the limit of "
            f"{settings.max_text_chars}. Split it into multiple generations."
        )

    if precomputed_chunks is not None:
        chunks = precomputed_chunks
    else:
        chunks = chunk_text_with_languages(text, language_id)
    if not chunks:
        raise InvalidTextError("No text to synthesize")

    logger.info("Generating %d chunk(s) for a %d-character script", len(chunks), len(text))

    with stage_timer() as t:
        conditionals = tts_engine.load_conditionals(embedding_path)
    if profile:
        profile.embedding_load_sec = t["elapsed"]

    needs_postprocess = settings.enable_silence_trim or settings.enable_loudness_normalization
    generate_fn = _generate_buffered if needs_postprocess else _generate_streamed
    cues, cumulative_sec, write_sec, postprocess_sec = generate_fn(
        chunks, conditionals, out_path, exaggeration, cfg_weight, on_progress, profile, job_id
    )

    if profile:
        profile.write_sec = write_sec
        profile.postprocess_sec = postprocess_sec
        profile.audio_duration_sec = cumulative_sec

    return cues


def _generate_streamed(
    chunks, conditionals, out_path, exaggeration, cfg_weight, on_progress, profile, job_id=None
) -> tuple[list[CaptionCue], float, float, float]:
    """No post-processing needed: stream each chunk directly to out_path."""
    writer: wave.Wave_write | None = None
    cues: list[CaptionCue] = []
    cumulative_sec = 0.0
    write_sec = 0.0
    truncated_count = 0

    try:
        for i, chunk in enumerate(chunks):
            wav, sample_rate, truncated = _generate_one_chunk(
                chunk, i, conditionals, exaggeration, cfg_weight, profile, job_id
            )
            if truncated:
                truncated_count += 1
            if writer is None:
                writer = _open_wav_writer(out_path, sample_rate)

            cue_end, gap = _append_cue_and_gap(cues, cumulative_sec, chunk, wav, sample_rate)
            cumulative_sec = cue_end + (gap.shape[-1] / sample_rate)

            with stage_timer() as t:
                _write_pcm16(writer, wav)
                _write_pcm16(writer, gap)
            write_sec += t["elapsed"]

            if on_progress:
                on_progress(i + 1, len(chunks))
    finally:
        if writer is not None:
            writer.close()

    _log_truncated(truncated_count, len(chunks))
    return cues, cumulative_sec, write_sec, 0.0


def _generate_buffered(
    chunks, conditionals, out_path, exaggeration, cfg_weight, on_progress, profile, job_id=None
) -> tuple[list[CaptionCue], float, float, float]:
    """Post-processing needed: keep chunks as in-memory tensors (avoids a
    wasteful disk round-trip since we need a full in-memory view anyway)."""
    pieces: list[torch.Tensor] = []
    cues: list[CaptionCue] = []
    cumulative_sec = 0.0
    sample_rate = None
    truncated_count = 0

    for i, chunk in enumerate(chunks):
        wav, sample_rate, truncated = _generate_one_chunk(
            chunk, i, conditionals, exaggeration, cfg_weight, profile, job_id
        )
        if truncated:
            truncated_count += 1
        pieces.append(wav)

        cue_end, gap = _append_cue_and_gap(cues, cumulative_sec, chunk, wav, sample_rate)
        cumulative_sec = cue_end + (gap.shape[-1] / sample_rate)
        pieces.append(gap)

        if on_progress:
            on_progress(i + 1, len(chunks))

    _log_truncated(truncated_count, len(chunks))

    with stage_timer() as t:
        audio = torch.cat(pieces)

        if settings.enable_silence_trim:
            audio, trimmed_start_sec = _trim_silence(audio, sample_rate, settings.silence_trim_threshold_db)
            final_duration = audio.shape[-1] / sample_rate
            for cue in cues:
                cue.start = max(0.0, cue.start - trimmed_start_sec)
                cue.end = max(0.0, min(cue.end - trimmed_start_sec, final_duration))

        if settings.enable_loudness_normalization:
            audio = _normalize_loudness(audio, sample_rate, settings.target_lufs)

        save_wav(audio, sample_rate, out_path)

    return cues, cumulative_sec, 0.0, t["elapsed"]


def _generate_one_chunk(chunk, index, conditionals, exaggeration, cfg_weight, profile, job_id=None):
    if job_id is not None:
        cached_path = job_store.chunk_audio_path(job_id, index)
        if cached_path.exists():
            wav, sample_rate = _read_pcm16_wav(cached_path)
            return wav, sample_rate, False

    with stage_timer() as t:
        wav, sample_rate, truncated = tts_engine.generate_chunk(
            chunk.text, conditionals,
            language_id=chunk.language_id, exaggeration=exaggeration, cfg_weight=cfg_weight,
        )
    if profile:
        profile.chunk_generate_sec.append(t["elapsed"])

    if job_id is not None:
        save_wav(wav, sample_rate, job_store.chunk_audio_path(job_id, index))

    return wav, sample_rate, truncated


def _append_cue_and_gap(cues, cumulative_sec, chunk, wav, sample_rate) -> tuple[float, torch.Tensor]:
    chunk_duration = wav.shape[-1] / sample_rate
    cue_end = cumulative_sec + chunk_duration
    cues.append(CaptionCue(start=cumulative_sec, end=cue_end, text=chunk.text))
    gap_sec = settings.chunk_gap_paragraph_sec if chunk.is_paragraph_end else settings.chunk_gap_sentence_sec
    return cue_end, torch.zeros(int(gap_sec * sample_rate))


def _log_truncated(truncated_count: int, total: int) -> None:
    if truncated_count:
        logger.warning("%d/%d chunk(s) hit the repetition cutoff even after retries", truncated_count, total)


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
    """pyloudnorm accepts float32 directly (verified) -- casting to float64
    ourselves first, on top of the float64 buffer pyloudnorm's own
    normalize.loudness() allocates internally regardless, was a redundant
    extra full-size copy. Skipping our own cast halves the float64 memory
    cost of this stage (one buffer instead of two)."""
    if samples.numel() == 0:
        return samples
    audio_np = samples.numpy()
    meter = pyln.Meter(sample_rate)
    try:
        loudness = meter.integrated_loudness(audio_np)
    except Exception:
        logger.warning("Could not measure loudness (likely near-silent audio), skipping normalization")
        return samples
    if loudness == float("-inf"):
        return samples

    normalized = pyln.normalize.loudness(audio_np, loudness, target_lufs)
    np.clip(normalized, -1.0, 1.0, out=normalized)
    return torch.from_numpy(normalized.astype(np.float32))


def save_wav(samples: torch.Tensor, sample_rate: int, path: Path) -> None:
    """Writes via stdlib `wave`, not torchaudio.save -- recent torchaudio versions
    route .save() through an optional torchcodec backend that isn't always
    installed; this has no such dependency."""
    writer = _open_wav_writer(path, sample_rate)
    try:
        _write_pcm16(writer, samples)
    finally:
        writer.close()
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
