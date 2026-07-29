"""Optional semantic search.

Requires `sentence-transformers` and `numpy`. The model runs locally and is
cached by the library after the first download. Without these installed the
engine still works — it just uses keyword search alone.
"""

from __future__ import annotations

import sqlite3
import struct
from dataclasses import dataclass


class EmbeddingsUnavailable(Exception):
    """Raised when semantic search is requested but its libraries are missing."""


def available() -> bool:
    try:
        import numpy  # noqa: F401
        import sentence_transformers  # noqa: F401
    except ImportError:
        return False
    return True


@dataclass
class Embedder:
    model_name: str

    def __post_init__(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise EmbeddingsUnavailable(
                "semantic search needs `pip install sentence-transformers numpy`"
            ) from exc
        self._model = SentenceTransformer(self.model_name)

    @property
    def dim(self) -> int:
        return int(self._model.get_sentence_embedding_dimension())

    def encode(self, texts: list[str], *, batch_size: int = 32):
        """Return L2-normalized float32 embeddings as a numpy array."""
        return self._model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        ).astype("float32")


def store_vectors(conn: sqlite3.Connection, chunk_ids: list[int], vectors) -> None:
    dim = int(vectors.shape[1])
    conn.executemany(
        "INSERT OR REPLACE INTO vectors(chunk_id, dim, data) VALUES(?,?,?)",
        [(cid, dim, vectors[i].tobytes()) for i, cid in enumerate(chunk_ids)],
    )


def search(
    conn: sqlite3.Connection, embedder: Embedder, query: str, limit: int = 50
) -> list[tuple[int, float]]:
    """Cosine similarity search. Vectors are normalized, so this is a dot product."""
    import numpy as np

    rows = conn.execute("SELECT chunk_id, dim, data FROM vectors").fetchall()
    if not rows:
        return []

    dim = rows[0]["dim"]
    ids = np.empty(len(rows), dtype="int64")
    matrix = np.empty((len(rows), dim), dtype="float32")
    for i, row in enumerate(rows):
        ids[i] = row["chunk_id"]
        matrix[i] = np.frombuffer(row["data"], dtype="float32", count=dim)

    query_vec = embedder.encode([query])[0]
    scores = matrix @ query_vec
    top = np.argsort(-scores)[:limit]
    return [(int(ids[i]), float(scores[i])) for i in top]


def pack(values: list[float]) -> bytes:
    """Serialize a plain float list (used by tests without numpy)."""
    return struct.pack(f"{len(values)}f", *values)
