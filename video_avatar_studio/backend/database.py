"""SQLite storage for avatar profiles (one calibration photo/video per name)."""

import sqlite3
import time
from pathlib import Path
from typing import Any

from .config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS avatars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    image_path TEXT NOT NULL,
    created_at REAL NOT NULL
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(_SCHEMA)


def insert_avatar(name: str, image_path: str) -> int:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO avatars (name, image_path, created_at) VALUES (?, ?, ?)",
            (name, image_path, time.time()),
        )
        return cur.lastrowid


def get_avatar(avatar_id: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM avatars WHERE id = ?", (avatar_id,)).fetchone()
        return dict(row) if row else None


def get_avatar_by_name(name: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM avatars WHERE name = ?", (name,)).fetchone()
        return dict(row) if row else None


def list_avatars() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM avatars ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]


def delete_avatar(avatar_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM avatars WHERE id = ?", (avatar_id,))
