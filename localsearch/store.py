"""SQLite storage: files, chunks, and the inverted index used for BM25.

The inverted index is built by hand rather than with FTS5 so the index is
portable across Python builds and so tokenization matches the query side
exactly.
"""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path

SCHEMA_VERSION = 1

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id        INTEGER PRIMARY KEY,
    path      TEXT NOT NULL UNIQUE,   -- relative to the indexed root
    mtime     REAL NOT NULL,
    size      INTEGER NOT NULL,
    n_chunks  INTEGER NOT NULL DEFAULT 0,
    indexed_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
    id       INTEGER PRIMARY KEY,
    file_id  INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    ordinal  INTEGER NOT NULL,
    text     TEXT NOT NULL,
    n_tokens INTEGER NOT NULL,
    start    INTEGER NOT NULL,
    end      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);

CREATE TABLE IF NOT EXISTS postings (
    term     TEXT NOT NULL,
    chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    tf       INTEGER NOT NULL,
    PRIMARY KEY (term, chunk_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_postings_chunk ON postings(chunk_id);

CREATE TABLE IF NOT EXISTS vectors (
    chunk_id INTEGER PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    dim      INTEGER NOT NULL,
    data     BLOB NOT NULL
);

CREATE TABLE IF NOT EXISTS skipped (
    path   TEXT PRIMARY KEY,
    reason TEXT NOT NULL
);
"""

_TOKEN = re.compile(r"[a-z0-9_]+")

# Very common words carry no signal and bloat the postings table.
STOPWORDS = frozenset("""
a an and are as at be but by for from has have how i if in into is it its of on
or that the their then there these this to was were what when where which who
why will with you your
""".split())


def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumerics, drop stopwords and 1-char noise."""
    tokens = _TOKEN.findall(text.lower())
    return [t for t in tokens if len(t) > 1 and t not in STOPWORDS]


@dataclass(frozen=True)
class ChunkRow:
    id: int
    path: str
    ordinal: int
    text: str
    n_tokens: int


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT OR IGNORE INTO meta(key, value) VALUES('schema_version', ?)",
        (str(SCHEMA_VERSION),),
    )
    conn.commit()
    return conn


def get_meta(conn: sqlite3.Connection, key: str, default: str | None = None) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO meta(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


def known_files(conn: sqlite3.Connection) -> dict[str, tuple[float, int]]:
    """Map of relative path -> (mtime, size) for everything currently indexed."""
    return {
        row["path"]: (row["mtime"], row["size"])
        for row in conn.execute("SELECT path, mtime, size FROM files")
    }


def delete_file(conn: sqlite3.Connection, path: str) -> None:
    row = conn.execute("SELECT id FROM files WHERE path = ?", (path,)).fetchone()
    if row is None:
        return
    file_id = row["id"]
    conn.execute(
        "DELETE FROM postings WHERE chunk_id IN (SELECT id FROM chunks WHERE file_id = ?)",
        (file_id,),
    )
    conn.execute(
        "DELETE FROM vectors WHERE chunk_id IN (SELECT id FROM chunks WHERE file_id = ?)",
        (file_id,),
    )
    conn.execute("DELETE FROM chunks WHERE file_id = ?", (file_id,))
    conn.execute("DELETE FROM files WHERE id = ?", (file_id,))


def upsert_file(
    conn: sqlite3.Connection,
    path: str,
    mtime: float,
    size: int,
    chunks: list[tuple[int, str, int, int]],
    indexed_at: float,
) -> list[int]:
    """Replace a file and its chunks. `chunks` is (ordinal, text, start, end)."""
    delete_file(conn, path)
    conn.execute("DELETE FROM skipped WHERE path = ?", (path,))
    cur = conn.execute(
        "INSERT INTO files(path, mtime, size, n_chunks, indexed_at) VALUES(?,?,?,?,?)",
        (path, mtime, size, len(chunks), indexed_at),
    )
    file_id = int(cur.lastrowid)

    chunk_ids: list[int] = []
    for ordinal, text, start, end in chunks:
        tokens = tokenize(text)
        cur = conn.execute(
            "INSERT INTO chunks(file_id, ordinal, text, n_tokens, start, end) "
            "VALUES(?,?,?,?,?,?)",
            (file_id, ordinal, text, len(tokens), start, end),
        )
        chunk_id = int(cur.lastrowid)
        chunk_ids.append(chunk_id)

        counts: dict[str, int] = {}
        for token in tokens:
            counts[token] = counts.get(token, 0) + 1
        conn.executemany(
            "INSERT INTO postings(term, chunk_id, tf) VALUES(?,?,?)",
            [(term, chunk_id, tf) for term, tf in counts.items()],
        )
    return chunk_ids


def mark_skipped(conn: sqlite3.Connection, path: str, reason: str) -> None:
    conn.execute(
        "INSERT INTO skipped(path, reason) VALUES(?,?) "
        "ON CONFLICT(path) DO UPDATE SET reason = excluded.reason",
        (path, reason),
    )


def stats(conn: sqlite3.Connection) -> dict[str, int | float]:
    def scalar(sql: str) -> int:
        row = conn.execute(sql).fetchone()
        return int(row[0] or 0)

    n_chunks = scalar("SELECT COUNT(*) FROM chunks")
    total_tokens = scalar("SELECT COALESCE(SUM(n_tokens), 0) FROM chunks")
    return {
        "files": scalar("SELECT COUNT(*) FROM files"),
        "chunks": n_chunks,
        "terms": scalar("SELECT COUNT(DISTINCT term) FROM postings"),
        "vectors": scalar("SELECT COUNT(*) FROM vectors"),
        "skipped": scalar("SELECT COUNT(*) FROM skipped"),
        "avg_tokens": (total_tokens / n_chunks) if n_chunks else 0.0,
    }


def fetch_chunks(conn: sqlite3.Connection, chunk_ids: list[int]) -> dict[int, ChunkRow]:
    if not chunk_ids:
        return {}
    placeholders = ",".join("?" * len(chunk_ids))
    rows = conn.execute(
        f"""SELECT c.id, f.path, c.ordinal, c.text, c.n_tokens
            FROM chunks c JOIN files f ON f.id = c.file_id
            WHERE c.id IN ({placeholders})""",
        chunk_ids,
    ).fetchall()
    return {
        r["id"]: ChunkRow(r["id"], r["path"], r["ordinal"], r["text"], r["n_tokens"])
        for r in rows
    }
