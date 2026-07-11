import io
import time

import pytest
from fastapi.testclient import TestClient

from backend import audio_utils, tts_engine
from backend.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def no_op_embedding_extraction(monkeypatch):
    def fake_extract(audio_path, embedding_path, exaggeration=0.5):
        with open(embedding_path, "wb") as f:
            f.write(b"fake-embedding")

    monkeypatch.setattr(tts_engine, "extract_and_save_embedding", fake_extract)


def _upload_voice(client, name="alice", content=b"RIFF....WAVEfmt fake wav bytes", filename="clip.wav"):
    return client.post(
        "/clone-voice",
        data={"name": name},
        files={"audio": (filename, io.BytesIO(content), "audio/wav")},
    )


def _poll_until_done(client, job_id, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/jobs/{job_id}").json()
        if job["status"] in ("done", "failed"):
            return job
        time.sleep(0.02)
    raise TimeoutError("job did not finish in time")


def test_clone_voice_success(client):
    resp = _upload_voice(client)
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "alice"
    assert "id" in body


def test_clone_voice_rejects_unsupported_extension(client):
    resp = _upload_voice(client, filename="clip.xyz")
    assert resp.status_code == 400
    assert "Unsupported audio format" in resp.json()["detail"]


def test_clone_voice_rejects_oversized_file(client, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "max_upload_mb", 0)
    resp = _upload_voice(client, content=b"x" * 2048)
    assert resp.status_code == 400
    assert "upload limit" in resp.json()["detail"]


def test_clone_voice_rejects_duplicate_name(client):
    assert _upload_voice(client, name="bob").status_code == 200
    resp = _upload_voice(client, name="bob")
    assert resp.status_code == 409


def test_clone_voice_rejects_empty_name(client):
    resp = _upload_voice(client, name="   ")
    assert resp.status_code == 400


def test_voices_list_includes_cloned_voice(client):
    _upload_voice(client, name="carol")
    resp = client.get("/voices")
    assert resp.status_code == 200
    names = [v["name"] for v in resp.json()]
    assert "carol" in names


def test_delete_voice(client):
    voice_id = _upload_voice(client, name="dave").json()["id"]

    resp = client.delete(f"/voices/{voice_id}")
    assert resp.status_code == 200

    resp = client.get("/voices")
    assert "dave" not in [v["name"] for v in resp.json()]

    resp = client.delete(f"/voices/{voice_id}")
    assert resp.status_code == 404


def test_generate_speech_voice_not_found(client):
    resp = client.post("/generate-speech", data={"text": "hello", "voice_id": 999999})
    assert resp.status_code == 404


def test_generate_speech_empty_text(client):
    voice_id = _upload_voice(client, name="erin").json()["id"]
    resp = client.post("/generate-speech", data={"text": "   ", "voice_id": voice_id})
    assert resp.status_code == 400


def test_generate_speech_full_job_flow(client, monkeypatch):
    voice_id = _upload_voice(client, name="frank").json()["id"]

    def fake_generate_long_form(text, embedding_path, **kwargs):
        on_progress = kwargs.get("on_progress")
        if on_progress:
            on_progress(1, 1)
        return "fake-samples", 16000

    def fake_save_wav(samples, sample_rate, path):
        path.write_bytes(b"RIFF-fake-wav-content")

    monkeypatch.setattr(audio_utils, "generate_long_form", fake_generate_long_form)
    monkeypatch.setattr(audio_utils, "save_wav", fake_save_wav)

    resp = client.post("/generate-speech", data={"text": "Hello world.", "voice_id": voice_id})
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    job = _poll_until_done(client, job_id)
    assert job["status"] == "done"

    download = client.get(f"/jobs/{job_id}/download")
    assert download.status_code == 200
    assert download.content == b"RIFF-fake-wav-content"


def test_generate_speech_job_failure_reported(client, monkeypatch):
    voice_id = _upload_voice(client, name="grace").json()["id"]

    def failing_generate_long_form(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(audio_utils, "generate_long_form", failing_generate_long_form)

    resp = client.post("/generate-speech", data={"text": "Hello world.", "voice_id": voice_id})
    job_id = resp.json()["job_id"]

    job = _poll_until_done(client, job_id)
    assert job["status"] == "failed"
    assert "boom" in job["error"]


def test_job_not_found(client):
    assert client.get("/jobs/does-not-exist").status_code == 404


def test_languages_endpoint(client, monkeypatch):
    monkeypatch.setattr(tts_engine, "get_supported_languages", lambda: {"en": "English", "fr": "French"})
    resp = client.get("/languages")
    assert resp.status_code == 200
    assert resp.json() == {"en": "English", "fr": "French"}
