"""High-level API tying config, index, retrieval and answering together."""

from __future__ import annotations

from pathlib import Path

from . import answer as answer_mod
from . import embeddings as emb
from . import indexer, retrieve, store
from .config import Config, db_path, resolve_root


class IndexMissing(Exception):
    """Raised when a folder has not been indexed yet."""


class Engine:
    """Search one folder. Use as a context manager to close the database."""

    def __init__(self, folder: str | Path | None = None, config: Config | None = None):
        self.root = resolve_root(folder)
        self.config = config or Config.load(self.root)
        self._conn = None
        self._embedder: emb.Embedder | None = None
        self._embedder_loaded = False

    # --- lifecycle ----------------------------------------------------------

    def __enter__(self) -> "Engine":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    @property
    def conn(self):
        if self._conn is None:
            path = db_path(self.root)
            if not path.exists():
                raise IndexMissing(
                    f"{self.root} has not been indexed yet. Run: localsearch index "
                    f"{self.root}"
                )
            self._conn = store.connect(path)
        return self._conn

    @property
    def indexed(self) -> bool:
        return db_path(self.root).exists()

    # --- operations ---------------------------------------------------------

    def index(self, *, rebuild: bool = False, progress=None) -> indexer.IndexResult:
        self.close()
        result = indexer.build(self.root, self.config, rebuild=rebuild, progress=progress)
        return result

    def stats(self) -> dict:
        data = dict(store.stats(self.conn))
        data["root"] = str(self.root)
        data["embedding_model"] = store.get_meta(self.conn, "embedding_model")
        return data

    def search(self, query: str, limit: int | None = None) -> list[retrieve.Hit]:
        return retrieve.search(
            self.conn,
            query,
            self.config,
            limit=limit or self.config.top_k,
            embedder=self.embedder(),
        )

    def ask(self, question: str, limit: int | None = None) -> answer_mod.Answer:
        hits = self.search(question, limit=limit)
        return answer_mod.generate(question, hits, self.config)

    def embedder(self) -> emb.Embedder | None:
        """Load the embedding model lazily, and only if the index has vectors."""
        if self._embedder_loaded:
            return self._embedder
        self._embedder_loaded = True
        if not self.config.embeddings or not retrieve.has_vectors(self.conn):
            return None
        model = store.get_meta(self.conn, "embedding_model") or self.config.embedding_model
        try:
            self._embedder = emb.Embedder(model)
        except emb.EmbeddingsUnavailable:
            self._embedder = None
        return self._embedder

    def skipped(self) -> list[tuple[str, str]]:
        return [
            (row["path"], row["reason"])
            for row in self.conn.execute(
                "SELECT path, reason FROM skipped ORDER BY path"
            )
        ]
