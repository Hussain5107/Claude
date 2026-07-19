from unittest.mock import MagicMock

import numpy as np
import pytest

from backend import tts_engine
from backend.exceptions import UnknownVoiceError, VoiceDownloadError


def test_is_voice_downloaded_false_when_missing(isolated_settings):
    assert tts_engine.is_voice_downloaded("en_US-lessac-medium") is False


def test_is_voice_downloaded_true_when_both_files_present(isolated_settings):
    code = "en_US-lessac-medium"
    (isolated_settings.voices_dir / f"{code}.onnx").write_bytes(b"fake")
    (isolated_settings.voices_dir / f"{code}.onnx.json").write_text("{}")
    assert tts_engine.is_voice_downloaded(code) is True


def test_ensure_voice_downloaded_rejects_unknown_voice(isolated_settings):
    with pytest.raises(UnknownVoiceError):
        tts_engine.ensure_voice_downloaded("not_a_real_voice-xyz-low")


def test_ensure_voice_downloaded_wraps_download_failures(isolated_settings, monkeypatch):
    def boom(code, download_dir):
        raise RuntimeError("network unreachable")

    monkeypatch.setattr(tts_engine, "_piper_download_voice", boom)
    with pytest.raises(VoiceDownloadError):
        tts_engine.ensure_voice_downloaded("en_US-lessac-medium")


def test_ensure_voice_downloaded_skips_download_if_already_present(isolated_settings, monkeypatch):
    code = "en_US-lessac-medium"
    (isolated_settings.voices_dir / f"{code}.onnx").write_bytes(b"fake")
    (isolated_settings.voices_dir / f"{code}.onnx.json").write_text("{}")

    called = []
    monkeypatch.setattr(tts_engine, "_piper_download_voice", lambda *a, **k: called.append(a))
    tts_engine.ensure_voice_downloaded(code)
    assert called == []


def test_get_model_caches_loaded_voice(isolated_settings, monkeypatch):
    code = "en_US-lessac-medium"
    monkeypatch.setattr(tts_engine, "ensure_voice_downloaded", lambda c: None)

    fake_voice = MagicMock()
    load_calls = []

    def fake_load(model_path):
        load_calls.append(model_path)
        return fake_voice

    monkeypatch.setattr(tts_engine.PiperVoice, "load", staticmethod(fake_load))
    tts_engine._voice_cache.clear()

    first = tts_engine.get_model(code)
    second = tts_engine.get_model(code)

    assert first is second is fake_voice
    assert len(load_calls) == 1


def test_synthesize_chunk_concatenates_audio_chunks(isolated_settings, monkeypatch):
    fake_voice = MagicMock()
    fake_voice.config.sample_rate = 22050
    chunk_a = MagicMock(audio_int16_array=np.array([1, 2, 3], dtype=np.int16))
    chunk_b = MagicMock(audio_int16_array=np.array([4, 5], dtype=np.int16))
    fake_voice.synthesize.return_value = [chunk_a, chunk_b]

    monkeypatch.setattr(tts_engine, "get_model", lambda code: fake_voice)

    samples, sr = tts_engine.synthesize_chunk("hello", "en_US-lessac-medium", 1.0)
    assert list(samples) == [1, 2, 3, 4, 5]
    assert sr == 22050
