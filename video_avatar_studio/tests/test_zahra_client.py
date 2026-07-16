from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend import zahra_client
from backend.exceptions import ZahraUnavailableError, ZahraVoiceError


def test_generate_narration_polls_until_done_and_saves_audio(tmp_path):
    responses = {
        ("POST", "/generate-speech"): MagicMock(status_code=202, json=lambda: {"job_id": "job1"}),
        ("GET", "/jobs/job1"): MagicMock(status_code=200, json=lambda: {"status": "done"}),
        ("GET", "/jobs/job1/download"): MagicMock(status_code=200, content=b"WAVDATA"),
    }

    def fake_request(method, url, timeout=None, **kwargs):
        for (m, path), resp in responses.items():
            if method == m and url.endswith(path):
                return resp
        raise AssertionError(f"unexpected request {method} {url}")

    out_path = tmp_path / "narration.wav"
    with patch("requests.request", side_effect=fake_request):
        result = zahra_client.generate_narration("hello world", 1, out_path)

    assert result == out_path
    assert out_path.read_bytes() == b"WAVDATA"


def test_generate_narration_raises_on_job_failure(tmp_path):
    def fake_request(method, url, timeout=None, **kwargs):
        if url.endswith("/generate-speech"):
            return MagicMock(status_code=202, json=lambda: {"job_id": "job1"})
        if url.endswith("/jobs/job1"):
            return MagicMock(status_code=200, json=lambda: {"status": "failed", "error": "boom"})
        raise AssertionError(f"unexpected request {method} {url}")

    with patch("requests.request", side_effect=fake_request):
        with pytest.raises(ZahraVoiceError, match="boom"):
            zahra_client.generate_narration("hello", 1, tmp_path / "out.wav")


def test_unreachable_zahra_raises_unavailable_error(tmp_path):
    import requests

    with patch("requests.request", side_effect=requests.exceptions.ConnectionError("refused")):
        with pytest.raises(ZahraUnavailableError):
            zahra_client.generate_narration("hello", 1, tmp_path / "out.wav")


def test_error_status_raises_voice_error():
    def fake_request(method, url, timeout=None, **kwargs):
        resp = MagicMock(status_code=404)
        resp.json.return_value = {"detail": "Voice 1 not found"}
        return resp

    with patch("requests.request", side_effect=fake_request):
        with pytest.raises(ZahraVoiceError, match="Voice 1 not found"):
            zahra_client.list_voices()
