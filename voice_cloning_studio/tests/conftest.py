"""Test setup shared by the whole suite.

``chatterbox`` requires downloading several GB of model weights at runtime
and isn't needed to test our own orchestration logic (chunking, job state
machine, HTTP contract, DB access) -- it's stubbed out in sys.modules
*before* anything under backend/ is imported, so the suite runs with no
GPU/model download required.

torch/torchaudio/numpy/pyloudnorm are kept real (not mocked): they're
moderate-sized, ordinary installs (no multi-GB weights), and our own audio
post-processing code (silence trimming, loudness normalization, caption
timing) does real tensor/array math that a mock can't meaningfully exercise.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

for module_name in ("chatterbox", "chatterbox.mtl_tts"):
    sys.modules.setdefault(module_name, MagicMock())

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
