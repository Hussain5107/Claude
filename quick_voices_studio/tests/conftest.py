"""Shared test setup.

Piper itself (unlike Chatterbox) is a small, ordinary install with no
multi-GB weights, so it's not mocked at the module level. What *is* mocked,
per-test, is `tts_engine.synthesize_chunk` -- it's the one function that
would otherwise need a downloaded voice model, and tests aren't expected to
have network access.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def isolated_settings(tmp_path, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "voices_dir", tmp_path / "voices")
    monkeypatch.setattr(settings, "output_dir", tmp_path / "output")
    settings.voices_dir.mkdir()
    settings.output_dir.mkdir()
    return settings
