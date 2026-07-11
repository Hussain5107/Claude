import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from .config import settings
from .logging_config import get_logger

logger = get_logger(__name__)


@contextmanager
def _connection():
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS voices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                audio_path TEXT NOT NULL,
                embedding_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
    logger.info("Database ready at %s", settings.db_path)


def insert_voice(name: str, audio_path: str, embedding_path: str) -> int:
    created_at = datetime.now(timezone.utc).isoformat()
    with _connection() as conn:
        cur = conn.execute(
            "INSERT INTO voices (name, audio_path, embedding_path, created_at) VALUES (?, ?, ?, ?)",
            (name, audio_path, embedding_path, created_at),
        )
        return cur.lastrowid


def list_voices() -> list[dict]:
    with _connection() as conn:
        rows = conn.execute("SELECT * FROM voices ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]


def get_voice(voice_id: int) -> dict | None:
    with _connection() as conn:
        row = conn.execute("SELECT * FROM voices WHERE id = ?", (voice_id,)).fetchone()
    return dict(row) if row else None


def get_voice_by_name(name: str) -> dict | None:
    with _connection() as conn:
        row = conn.execute("SELECT * FROM voices WHERE name = ?", (name,)).fetchone()
    return dict(row) if row else None


def delete_voice(voice_id: int) -> bool:
    with _connection() as conn:
        cur = conn.execute("DELETE FROM voices WHERE id = ?", (voice_id,))
        return cur.rowcount > 0
