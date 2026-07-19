import time

from fastapi.testclient import TestClient

from backend import audio_utils
from backend.main import app

client = TestClient(app)


def test_list_voices_returns_catalog():
    resp = client.get("/voices")
    assert resp.status_code == 200
    codes = [v["code"] for v in resp.json()]
    assert "en_US-lessac-medium" in codes


def test_list_languages():
    resp = client.get("/languages")
    assert resp.status_code == 200
    codes = [lang["code"] for lang in resp.json()]
    assert "en" in codes


def test_generate_speech_rejects_unknown_voice():
    resp = client.post(
        "/generate-speech", data={"text": "hello", "voice_code": "nope-xyz-low"}
    )
    assert resp.status_code == 404


def test_generate_speech_job_lifecycle(monkeypatch, tmp_path):
    def fake_generate_long_form(text, voice_code, out_path, length_scale=1.0, on_progress=None):
        out_path.write_bytes(b"RIFF-fake-wav-bytes")
        if on_progress:
            on_progress(1, 1)
        return 1.0

    monkeypatch.setattr(audio_utils, "generate_long_form", fake_generate_long_form)

    resp = client.post(
        "/generate-speech",
        data={"text": "hello world", "voice_code": "en_US-lessac-medium", "length_scale": 1.0},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    for _ in range(50):
        status = client.get(f"/jobs/{job_id}").json()
        if status["status"] == "done":
            break
        time.sleep(0.02)

    assert status["status"] == "done"
    assert status["chunks_done"] == 1

    download = client.get(f"/jobs/{job_id}/download")
    assert download.status_code == 200
    assert download.content == b"RIFF-fake-wav-bytes"


def test_job_status_unknown_job_returns_404():
    resp = client.get("/jobs/does-not-exist")
    assert resp.status_code == 404


def test_download_before_done_returns_conflict(monkeypatch):
    from backend.jobs import job_manager

    job_id = job_manager.submit(lambda job: time.sleep(1) or None)
    resp = client.get(f"/jobs/{job_id}/download")
    assert resp.status_code == 409
