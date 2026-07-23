"""Tests for the pure-logic pieces of tts_engine.py.

Deliberately does NOT call get_model() -- it calls
torch.set_num_interop_threads(), which PyTorch only allows once per
process; calling it here would make the test suite's pass/fail depend on
run order and risk breaking future tests that need it for real.
"""

import logging
from unittest.mock import MagicMock

from backend import tts_engine


def test_get_device_respects_override(monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "device_override", "cuda")
    assert tts_engine.get_device() == "cuda"


def test_get_device_auto_detects_when_no_override(monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "device_override", "")
    # torch.cuda.is_available() is real (torch isn't mocked) and False on this box
    assert tts_engine.get_device() == "cpu"


def test_last_model_load_seconds_defaults_to_zero():
    assert tts_engine.get_last_model_load_seconds() >= 0.0


def test_repetition_cutoff_detector_triggers_on_token_repetition():
    # exact message shape observed in a real backend log
    with tts_engine._watch_for_repetition_cutoff() as detector:
        logging.getLogger(tts_engine._ALIGNMENT_LOGGER_NAME).warning(
            "forcing EOS token, long_tail=tensor(False), "
            "alignment_repetition=tensor(False), token_repetition=True"
        )
    assert detector.triggered is True


def test_repetition_cutoff_detector_triggers_on_alignment_repetition():
    with tts_engine._watch_for_repetition_cutoff() as detector:
        logging.getLogger(tts_engine._ALIGNMENT_LOGGER_NAME).warning(
            "forcing EOS token, long_tail=tensor(False), "
            "alignment_repetition=tensor(True), token_repetition=False"
        )
    assert detector.triggered is True


def test_repetition_cutoff_detector_ignores_benign_long_tail_stop():
    # long_tail-only forced EOS means speech completed and the model was
    # producing trailing silence -- the audio is fine, no retry warranted
    with tts_engine._watch_for_repetition_cutoff() as detector:
        logging.getLogger(tts_engine._ALIGNMENT_LOGGER_NAME).warning(
            "forcing EOS token, long_tail=tensor(True), "
            "alignment_repetition=tensor(False), token_repetition=False"
        )
    assert detector.triggered is False


def test_repetition_cutoff_detector_ignores_unrelated_messages():
    with tts_engine._watch_for_repetition_cutoff() as detector:
        logging.getLogger(tts_engine._ALIGNMENT_LOGGER_NAME).warning("something unrelated happened")
    assert detector.triggered is False


def test_repetition_cutoff_detector_removes_handler_after_context():
    target = logging.getLogger(tts_engine._ALIGNMENT_LOGGER_NAME)
    handlers_before = len(target.handlers)
    with tts_engine._watch_for_repetition_cutoff():
        assert len(target.handlers) == handlers_before + 1
    assert len(target.handlers) == handlers_before


def test_generate_once_passes_temperature_to_model_generate():
    fake_model = MagicMock()
    fake_model.generate.return_value = MagicMock(squeeze=lambda dim: "fake-wav")

    tts_engine._generate_once(fake_model, "hello", "en", exaggeration=0.5, cfg_weight=0.5, temperature=1.2)

    fake_model.generate.assert_called_once_with(
        "hello", language_id="en", exaggeration=0.5, cfg_weight=0.5, temperature=1.2
    )


def test_load_conditionals_caches_by_path_and_mtime(tmp_path, monkeypatch):
    emb = tmp_path / "voice.pt"
    emb.write_bytes(b"fake")

    fake_conds = MagicMock()
    fake_conds.to.return_value = fake_conds
    load_calls = []
    monkeypatch.setattr(tts_engine, "get_model", lambda: MagicMock(device="cpu"))
    monkeypatch.setattr(
        tts_engine.Conditionals, "load",
        staticmethod(lambda p, map_location=None: load_calls.append(p) or fake_conds),
    )
    tts_engine._conditionals_cache.clear()

    first = tts_engine.load_conditionals(str(emb))
    second = tts_engine.load_conditionals(str(emb))
    assert first is second
    assert len(load_calls) == 1  # second call served from cache

    # touching the file (re-clone) invalidates the cached entry
    import os
    os.utime(emb, (os.path.getmtime(emb) + 10, os.path.getmtime(emb) + 10))
    tts_engine.load_conditionals(str(emb))
    assert len(load_calls) == 2
