import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "voices.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
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
    conn.commit()
    conn.close()


def insert_voice(name: str, audio_path: str, embedding_path: str) -> int:
    conn = get_connection()
    created_at = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        "INSERT INTO voices (name, audio_path, embedding_path, created_at) VALUES (?, ?, ?, ?)",
        (name, audio_path, embedding_path, created_at),
    )
    conn.commit()
    voice_id = cur.lastrowid
    conn.close()
    return voice_id


def list_voices() -> list[dict]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM voices ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_voice(voice_id: int) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM voices WHERE id = ?", (voice_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_voice_by_name(name: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM voices WHERE name = ?", (name,)).fetchone()
    conn.close()
    return dict(row) if row else None
