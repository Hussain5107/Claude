"""Walk a folder, extract text, chunk it, and write it into the index.

Re-runs are incremental: a file is only re-read when its mtime or size changed,
and files deleted from disk are dropped from the index.
"""

from __future__ import annotations

import fnmatch
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterator

from . import embeddings as emb
from . import store
from .chunking import chunk_text
from .config import Config, db_path
from .loaders import UnsupportedFile, is_supported, load_text

Progress = Callable[[str], None]


@dataclass
class IndexResult:
    added: int = 0
    updated: int = 0
    removed: int = 0
    unchanged: int = 0
    skipped: list[tuple[str, str]] = field(default_factory=list)
    chunks: int = 0
    embedded: int = 0
    seconds: float = 0.0

    def summary(self) -> str:
        parts = [
            f"{self.added} added",
            f"{self.updated} updated",
            f"{self.unchanged} unchanged",
            f"{self.removed} removed",
            f"{self.chunks} chunks",
        ]
        if self.embedded:
            parts.append(f"{self.embedded} embedded")
        if self.skipped:
            parts.append(f"{len(self.skipped)} skipped")
        return ", ".join(parts) + f" in {self.seconds:.1f}s"


def iter_files(root: Path, config: Config) -> Iterator[Path]:
    """Yield indexable files under *root*, honouring exclusions."""
    excluded = set(config.exclude_dirs)
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            entries = sorted(current.iterdir())
        except (PermissionError, OSError):
            continue
        for entry in entries:
            if entry.name.startswith(".") and entry.name not in {".env.example"}:
                # Hidden files are almost never user documents.
                if entry.is_dir() or entry.suffix.lower() not in {".md", ".txt"}:
                    continue
            if entry.is_symlink() and not config.follow_symlinks:
                continue
            if entry.is_dir():
                if entry.name not in excluded:
                    stack.append(entry)
                continue
            if not entry.is_file() or not is_supported(entry):
                continue
            rel = entry.relative_to(root).as_posix()
            if any(fnmatch.fnmatch(rel, pattern) for pattern in config.exclude_globs):
                continue
            yield entry


def build(
    root: Path,
    config: Config,
    *,
    rebuild: bool = False,
    progress: Progress | None = None,
) -> IndexResult:
    """Index (or re-index) *root*. Returns a summary of what changed."""
    started = time.time()
    say = progress or (lambda _msg: None)
    result = IndexResult()

    path = db_path(root)
    if rebuild and path.exists():
        path.unlink()
        for sidecar in (path.with_suffix(".db-wal"), path.with_suffix(".db-shm")):
            sidecar.unlink(missing_ok=True)

    conn = store.connect(path)
    try:
        store.set_meta(conn, "root", str(root))

        embedder = None
        if config.embeddings:
            embedder = emb.Embedder(config.embedding_model)  # raises if unavailable
            store.set_meta(conn, "embedding_model", config.embedding_model)

        existing = store.known_files(conn)
        seen: set[str] = set()
        max_bytes = int(config.max_file_mb * 1024 * 1024)
        pending: list[tuple[list[int], list[str]]] = []

        for file_path in iter_files(root, config):
            rel = file_path.relative_to(root).as_posix()
            seen.add(rel)
            try:
                stat = file_path.stat()
            except OSError:
                continue

            previous = existing.get(rel)
            if previous and previous == (stat.st_mtime, stat.st_size):
                result.unchanged += 1
                continue

            if stat.st_size > max_bytes:
                reason = f"larger than {config.max_file_mb} MB"
                store.mark_skipped(conn, rel, reason)
                result.skipped.append((rel, reason))
                continue

            try:
                text = load_text(file_path)
            except UnsupportedFile as exc:
                store.mark_skipped(conn, rel, str(exc))
                result.skipped.append((rel, str(exc)))
                continue
            except OSError as exc:
                store.mark_skipped(conn, rel, f"read error: {exc}")
                result.skipped.append((rel, f"read error: {exc}"))
                continue

            pieces = chunk_text(text, config.chunk_size, config.chunk_overlap)
            if not pieces:
                reason = "no text content"
                store.mark_skipped(conn, rel, reason)
                result.skipped.append((rel, reason))
                continue

            chunk_ids = store.upsert_file(
                conn,
                rel,
                stat.st_mtime,
                stat.st_size,
                [(c.ordinal, c.text, c.start, c.end) for c in pieces],
                time.time(),
            )
            result.chunks += len(pieces)
            if previous:
                result.updated += 1
                say(f"  updated  {rel} ({len(pieces)} chunks)")
            else:
                result.added += 1
                say(f"  added    {rel} ({len(pieces)} chunks)")

            if embedder is not None:
                pending.append((chunk_ids, [c.text for c in pieces]))
                if sum(len(ids) for ids, _ in pending) >= 64:
                    result.embedded += _flush_embeddings(conn, embedder, pending)
                    pending.clear()

        if embedder is not None and pending:
            result.embedded += _flush_embeddings(conn, embedder, pending)

        for rel in set(existing) - seen:
            store.delete_file(conn, rel)
            result.removed += 1
            say(f"  removed  {rel}")

        store.set_meta(conn, "indexed_at", str(time.time()))
        conn.commit()
    finally:
        conn.close()

    result.seconds = time.time() - started
    return result


def _flush_embeddings(conn, embedder, pending) -> int:
    ids = [cid for chunk_ids, _ in pending for cid in chunk_ids]
    texts = [text for _, chunk_texts in pending for text in chunk_texts]
    vectors = embedder.encode(texts)
    emb.store_vectors(conn, ids, vectors)
    return len(ids)
