"""Test setup shared by the whole suite.

Chatterbox/torch are several-GB dependencies not needed to test our own
orchestration logic (chunking, job state machine, HTTP contract, DB access).
We stub them out in sys.modules *before* anything under backend/ is
imported, so the full test suite runs fast with no GPU/heavy install
required -- exactly what CI needs.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

for module_name in ("torch", "torchaudio", "chatterbox", "chatterbox.mtl_tts"):
    sys.modules.setdefault(module_name, MagicMock())

sys.modules["torch"].cuda.is_available.return_value = False

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_settings(tmp_path, monkeypatch):
    """Points every test at a throwaway directory instead of the real project paths."""
    from backend.config import settings

    monkeypatch.setattr(settings, "voices_dir", tmp_path / "voices")
    monkeypatch.setattr(settings, "output_dir", tmp_path / "output")
    monkeypatch.setattr(settings, "db_path", tmp_path / "voices.db")
    settings.voices_dir.mkdir()
    settings.output_dir.mkdir()
    return settings
