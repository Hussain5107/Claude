"""Tests for the pure-logic pieces of tts_engine.py.

Deliberately does NOT call get_model() -- it calls
torch.set_num_interop_threads(), which PyTorch only allows once per
process; calling it here would make the test suite's pass/fail depend on
run order and risk breaking future tests that need it for real.
"""

import logging

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


def test_repetition_cutoff_detector_triggers_on_eos_message():
    with tts_engine._watch_for_repetition_cutoff() as detector:
        logging.getLogger(tts_engine._ALIGNMENT_LOGGER_NAME).warning(
            "some prefix forcing EOS token some suffix"
        )
    assert detector.triggered is True


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
