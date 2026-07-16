import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from backend import database
from backend.config import settings


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "db_path", tmp_path / "avatars.db")
    monkeypatch.setattr(settings, "avatars_dir", tmp_path / "avatars")
    monkeypatch.setattr(settings, "output_dir", tmp_path / "output")
    settings.avatars_dir.mkdir(exist_ok=True)
    settings.output_dir.mkdir(exist_ok=True)
    database.init_db()
    yield
