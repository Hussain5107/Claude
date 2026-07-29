"""Split documents into overlapping chunks that respect natural boundaries."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Split points, strongest first: blank lines, then single newlines, then
# sentence ends. Falls back to a hard cut if a "paragraph" is enormous.
_PARAGRAPH = re.compile(r"\n\s*\n")
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


@dataclass(frozen=True)
class Chunk:
    ordinal: int
    text: str
    start: int   # character offset in the source document
    end: int


def normalize(text: str) -> str:
    """Collapse noisy whitespace while preserving paragraph structure."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, size: int = 1200, overlap: int = 200) -> list[Chunk]:
    """Chunk *text* into ~`size`-character pieces overlapping by `overlap`."""
    if size <= 0:
        raise ValueError("size must be positive")
    overlap = max(0, min(overlap, size // 2))
    text = normalize(text)
    if not text:
        return []

    units = _split_units(text, size)
    chunks: list[Chunk] = []
    buffer: list[str] = []
    buf_len = 0
    start = 0
    cursor = 0

    def flush() -> None:
        nonlocal buffer, buf_len, start
        body = "".join(buffer).strip()
        if body:
            chunks.append(Chunk(len(chunks), body, start, start + len(body)))

    for unit in units:
        if buf_len and buf_len + len(unit) > size:
            flush()
            tail = _tail(buffer, overlap)
            buffer = [tail] if tail else []
            buf_len = len(tail)
            start = cursor - buf_len
        if not buffer:
            start = cursor
        buffer.append(unit)
        buf_len += len(unit)
        cursor += len(unit)

    flush()
    return chunks


def _split_units(text: str, size: int) -> list[str]:
    """Break text into pieces no larger than `size`, keeping separators."""
    units: list[str] = []
    for para in _keep_split(_PARAGRAPH, text):
        if len(para) <= size:
            units.append(para)
            continue
        for line in _keep_split(re.compile(r"\n"), para):
            if len(line) <= size:
                units.append(line)
                continue
            for sentence in _keep_split(_SENTENCE, line):
                if len(sentence) <= size:
                    units.append(sentence)
                else:
                    units.extend(
                        sentence[i:i + size] for i in range(0, len(sentence), size)
                    )
    return [u for u in units if u]


def _keep_split(pattern: re.Pattern[str], text: str) -> list[str]:
    """Split on *pattern* but keep the separator attached to the left piece."""
    pieces: list[str] = []
    last = 0
    for match in pattern.finditer(text):
        pieces.append(text[last:match.end()])
        last = match.end()
    pieces.append(text[last:])
    return [p for p in pieces if p]


def _tail(buffer: list[str], overlap: int) -> str:
    if overlap <= 0:
        return ""
    joined = "".join(buffer)
    return joined[-overlap:] if len(joined) > overlap else joined
