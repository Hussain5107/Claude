"""Retrieval: BM25 keyword search, optional semantic search, fused with RRF."""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass

from . import bm25
from . import embeddings as emb
from . import store
from .config import Config

RRF_K = 60  # standard reciprocal-rank-fusion damping constant


@dataclass
class Hit:
    chunk_id: int
    path: str
    ordinal: int
    text: str
    score: float
    keyword_rank: int | None = None
    semantic_rank: int | None = None

    @property
    def citation(self) -> str:
        return f"{self.path}#{self.ordinal}"


def search(
    conn: sqlite3.Connection,
    query: str,
    config: Config,
    *,
    limit: int = 8,
    pool: int = 50,
    embedder: "emb.Embedder | None" = None,
) -> list[Hit]:
    """Retrieve the best chunks for *query*.

    Keyword results always participate. Semantic results join in when the index
    has vectors and an embedder was supplied; the two lists are then merged with
    reciprocal rank fusion, which needs no score calibration between them.
    """
    keyword = bm25.search(conn, query, limit=pool)
    semantic: list[tuple[int, float]] = []
    if embedder is not None:
        semantic = emb.search(conn, embedder, query, limit=pool)

    fused: dict[int, float] = {}
    keyword_ranks = {cid: i for i, (cid, _) in enumerate(keyword)}
    semantic_ranks = {cid: i for i, (cid, _) in enumerate(semantic)}

    for ranks in (keyword_ranks, semantic_ranks):
        for chunk_id, rank in ranks.items():
            fused[chunk_id] = fused.get(chunk_id, 0.0) + 1.0 / (RRF_K + rank + 1)

    if not fused:
        return []

    ordered = sorted(fused.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]
    rows = store.fetch_chunks(conn, [cid for cid, _ in ordered])

    hits: list[Hit] = []
    for chunk_id, score in ordered:
        row = rows.get(chunk_id)
        if row is None:
            continue
        hits.append(
            Hit(
                chunk_id=chunk_id,
                path=row.path,
                ordinal=row.ordinal,
                text=row.text,
                score=score,
                keyword_rank=keyword_ranks.get(chunk_id),
                semantic_rank=semantic_ranks.get(chunk_id),
            )
        )
    return hits


def has_vectors(conn: sqlite3.Connection) -> bool:
    row = conn.execute("SELECT 1 FROM vectors LIMIT 1").fetchone()
    return row is not None


def snippet(text: str, query: str, width: int = 240) -> str:
    """A short excerpt centred on the first query term that appears in *text*."""
    terms = store.tokenize(query)
    lowered = text.lower()
    position = -1
    for term in terms:
        match = re.search(rf"\b{re.escape(term)}", lowered)
        if match:
            position = match.start()
            break
    if position < 0:
        excerpt = text[:width]
        return excerpt + ("…" if len(text) > width else "")

    start = max(0, position - width // 3)
    end = min(len(text), start + width)
    excerpt = text[start:end].strip()
    return ("…" if start > 0 else "") + excerpt + ("…" if end < len(text) else "")


def build_context(hits: list[Hit], max_chars: int = 12000) -> str:
    """Format hits into a numbered context block the model can cite from."""
    blocks: list[str] = []
    used = 0
    for i, hit in enumerate(hits, start=1):
        body = hit.text.strip()
        header = f"[{i}] {hit.citation}"
        block = f"{header}\n{body}"
        if used + len(block) > max_chars:
            remaining = max_chars - used - len(header) - 2
            if remaining < 200:
                break
            block = f"{header}\n{body[:remaining]}…"
            blocks.append(block)
            break
        blocks.append(block)
        used += len(block)
    return "\n\n---\n\n".join(blocks)
