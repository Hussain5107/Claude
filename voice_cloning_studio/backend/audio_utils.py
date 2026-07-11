import re
from pathlib import Path

import torch
import torchaudio

from . import tts_engine

MAX_CHUNK_CHARS = 300


def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks = []
    for para in paragraphs:
        sentences = re.findall(r"[^.!?]+[.!?]*\s*", para) or [para]
        current = ""
        for sentence in sentences:
            if len(current) + len(sentence) > max_chars and current:
                chunks.append(current.strip())
                current = sentence
            else:
                current += sentence
        if current.strip():
            chunks.append(current.strip())
    return chunks


def generate_long_form(
    text: str,
    embedding_path: str,
    language_id: str = "en",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
) -> tuple[torch.Tensor, int]:
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No text to synthesize")

    pieces = []
    sample_rate = None
    for chunk in chunks:
        wav, sample_rate = tts_engine.generate_with_embedding(
            chunk,
            embedding_path,
            language_id=language_id,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
        pieces.append(wav)
        pieces.append(torch.zeros(int(0.25 * sample_rate)))

    return torch.cat(pieces), sample_rate


def save_wav(samples: torch.Tensor, sample_rate: int, path: Path) -> None:
    torchaudio.save(str(path), samples.unsqueeze(0), sample_rate)
