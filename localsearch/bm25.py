"""BM25 ranking over the SQLite inverted index (pure Python, no dependencies)."""

from __future__ import annotations

import math
import sqlite3

K1 = 1.5   # term-frequency saturation
B = 0.75   # length normalization


def search(
    conn: sqlite3.Connection,
    query: str,
    limit: int = 50,
    *,
    tokenizer=None,
) -> list[tuple[int, float]]:
    """Return (chunk_id, score) pairs ranked by BM25, best first."""
    from .store import tokenize as default_tokenize

    tokenize = tokenizer or default_tokenize
    terms = tokenize(query)
    if not terms:
        return []

    row = conn.execute(
        "SELECT COUNT(*) AS n, COALESCE(AVG(n_tokens), 0) AS avg FROM chunks"
    ).fetchone()
    n_docs, avg_len = int(row["n"]), float(row["avg"]) or 1.0
    if n_docs == 0:
        return []

    # Query terms repeated more than once should not count twice as much.
    unique_terms = list(dict.fromkeys(terms))
    scores: dict[int, float] = {}

    for term in unique_terms:
        postings = conn.execute(
            """SELECT p.chunk_id, p.tf, c.n_tokens
               FROM postings p JOIN chunks c ON c.id = p.chunk_id
               WHERE p.term = ?""",
            (term,),
        ).fetchall()
        df = len(postings)
        if df == 0:
            continue
        idf = math.log(1 + (n_docs - df + 0.5) / (df + 0.5))
        for posting in postings:
            tf = posting["tf"]
            length = posting["n_tokens"] or 1
            denom = tf + K1 * (1 - B + B * length / avg_len)
            scores[posting["chunk_id"]] = scores.get(posting["chunk_id"], 0.0) + idf * (
                tf * (K1 + 1) / denom
            )

    ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    return ranked[:limit]
