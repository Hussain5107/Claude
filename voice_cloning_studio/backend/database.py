import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from .config import settings
from .logging_config import get_logger

logger = get_logger(__name__)

_DEFAULT_COLUMNS = {
    "default_exaggeration": "REAL",
    "default_cfg_weight": "REAL",
    "default_language": "TEXT",
}


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
        existing = {row["name"] for row in conn.execute("PRAGMA table_info(voices)")}
        for column, sql_type in _DEFAULT_COLUMNS.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE voices ADD COLUMN {column} {sql_type}")
                logger.info("Migrated voices table: added column %s", column)
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


def update_voice_defaults(voice_id: int, exaggeration: float, cfg_weight: float, language: str) -> bool:
    with _connection() as conn:
        cur = conn.execute(
            "UPDATE voices SET default_exaggeration = ?, default_cfg_weight = ?, default_language = ? "
            "WHERE id = ?",
            (exaggeration, cfg_weight, language, voice_id),
        )
        return cur.rowcount > 0
