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


def test_get_single_voice(client):
    voice_id = _upload_voice(client, name="single").json()["id"]
    resp = client.get(f"/voices/{voice_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "single"


def test_get_single_voice_not_found(client):
    assert client.get("/voices/999999").status_code == 404


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

    def fake_generate_long_form(text, embedding_path, out_path, **kwargs):
        on_progress = kwargs.get("on_progress")
        if on_progress:
            on_progress(1, 1)
        out_path.write_bytes(b"RIFF-fake-wav-content")
        return [audio_utils.CaptionCue(0.0, 1.0, text)]

    def fake_write_srt(cues, path):
        path.write_text("1\n00:00:00,000 --> 00:00:01,000\nHello world.\n")

    monkeypatch.setattr(audio_utils, "generate_long_form", fake_generate_long_form)
    monkeypatch.setattr(audio_utils, "write_srt", fake_write_srt)

    resp = client.post("/generate-speech", data={"text": "Hello world.", "voice_id": voice_id})
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    job = _poll_until_done(client, job_id)
    assert job["status"] == "done"
    assert job["has_captions"] is True

    download = client.get(f"/jobs/{job_id}/download")
    assert download.status_code == 200
    assert download.content == b"RIFF-fake-wav-content"

    captions = client.get(f"/jobs/{job_id}/captions")
    assert captions.status_code == 200
    assert b"Hello world." in captions.content


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


def _failing_generate_long_form(*args, **kwargs):
    raise RuntimeError("boom")


def _succeeding_generate_long_form(content: bytes = b"RIFF-fake-wav-content"):
    def fake(text, embedding_path, out_path, **kwargs):
        on_progress = kwargs.get("on_progress")
        if on_progress:
            on_progress(1, 1)
        out_path.write_bytes(content)
        return [audio_utils.CaptionCue(0.0, 1.0, text)]

    return fake


def test_resumable_jobs_lists_failed_job(client, monkeypatch):
    voice_id = _upload_voice(client, name="ruth").json()["id"]
    monkeypatch.setattr(audio_utils, "generate_long_form", _failing_generate_long_form)

    resp = client.post(
        "/generate-speech", data={"text": "Hello there.\n\nSecond part.", "voice_id": voice_id}
    )
    job_id = resp.json()["job_id"]
    _poll_until_done(client, job_id)  # let JobManager mark it failed

    resumable = client.get("/jobs/resumable").json()
    entry = next((r for r in resumable if r["job_id"] == job_id), None)
    assert entry is not None
    assert entry["voice_name"] == "ruth"
    assert entry["chunks_total"] == 2


def test_resumable_jobs_excludes_successfully_completed_job(client, monkeypatch):
    voice_id = _upload_voice(client, name="sam").json()["id"]
    monkeypatch.setattr(audio_utils, "generate_long_form", _succeeding_generate_long_form())
    monkeypatch.setattr(audio_utils, "write_srt", lambda cues, path: path.write_text("captions"))

    resp = client.post("/generate-speech", data={"text": "Hello world.", "voice_id": voice_id})
    job_id = resp.json()["job_id"]
    _poll_until_done(client, job_id)

    resumable_ids = {r["job_id"] for r in client.get("/jobs/resumable").json()}
    assert job_id not in resumable_ids


def test_resume_unknown_job_404(client):
    assert client.post("/jobs/does-not-exist/resume").status_code == 404


def test_resume_continues_a_failed_job_and_reaches_done(client, monkeypatch):
    voice_id = _upload_voice(client, name="tina").json()["id"]

    monkeypatch.setattr(audio_utils, "generate_long_form", _failing_generate_long_form)
    resp = client.post("/generate-speech", data={"text": "Hello world.", "voice_id": voice_id})
    job_id = resp.json()["job_id"]
    first_attempt = _poll_until_done(client, job_id)
    assert first_attempt["status"] == "failed"

    monkeypatch.setattr(audio_utils, "generate_long_form", _succeeding_generate_long_form(b"resumed-audio"))
    monkeypatch.setattr(audio_utils, "write_srt", lambda cues, path: path.write_text("resumed captions"))

    resume_resp = client.post(f"/jobs/{job_id}/resume")
    assert resume_resp.status_code == 202
    assert resume_resp.json()["job_id"] == job_id

    second_attempt = _poll_until_done(client, job_id)
    assert second_attempt["status"] == "done"
    assert client.get(f"/jobs/{job_id}/download").content == b"resumed-audio"

    # the job finished successfully, so it should no longer be resumable
    resumable_ids = {r["job_id"] for r in client.get("/jobs/resumable").json()}
    assert job_id not in resumable_ids


def test_resume_already_completed_job_returns_404(client, monkeypatch):
    """A successfully completed job has its manifest/chunk cache cleaned up
    entirely (nothing left to resume), so trying to resume it afterwards is
    indistinguishable from resuming a job_id that never existed."""
    voice_id = _upload_voice(client, name="uma").json()["id"]
    monkeypatch.setattr(audio_utils, "generate_long_form", _succeeding_generate_long_form())
    monkeypatch.setattr(audio_utils, "write_srt", lambda cues, path: path.write_text("captions"))

    resp = client.post("/generate-speech", data={"text": "Hello world.", "voice_id": voice_id})
    job_id = resp.json()["job_id"]
    _poll_until_done(client, job_id)

    resume_resp = client.post(f"/jobs/{job_id}/resume")
    assert resume_resp.status_code == 404


def test_captions_not_ready_before_job_done(client, monkeypatch):
    voice_id = _upload_voice(client, name="hank").json()["id"]

    def slow_generate_long_form(text, embedding_path, out_path, **kwargs):
        time.sleep(0.5)
        out_path.write_bytes(b"x")
        return []

    monkeypatch.setattr(audio_utils, "generate_long_form", slow_generate_long_form)
    monkeypatch.setattr(audio_utils, "write_srt", lambda *a, **k: None)

    resp = client.post("/generate-speech", data={"text": "Hello world.", "voice_id": voice_id})
    job_id = resp.json()["job_id"]
    captions_resp = client.get(f"/jobs/{job_id}/captions")
    assert captions_resp.status_code == 409

    _poll_until_done(client, job_id)  # let it finish before the test tears down


def test_set_and_read_voice_defaults(client):
    voice_id = _upload_voice(client, name="ivy").json()["id"]

    resp = client.patch(
        f"/voices/{voice_id}/defaults",
        json={"exaggeration": 0.7, "cfg_weight": 0.3, "language": "fr"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["default_exaggeration"] == 0.7
    assert body["default_cfg_weight"] == 0.3
    assert body["default_language"] == "fr"

    voices = {v["name"]: v for v in client.get("/voices").json()}
    assert voices["ivy"]["default_exaggeration"] == 0.7


def test_set_voice_defaults_unknown_voice(client):
    body = {"exaggeration": 0.5, "cfg_weight": 0.5, "language": "en"}
    resp = client.patch("/voices/999999/defaults", json=body)
    assert resp.status_code == 404


def test_languages_endpoint(client, monkeypatch):
    monkeypatch.setattr(tts_engine, "get_supported_languages", lambda: {"en": "English", "fr": "French"})
    resp = client.get("/languages")
    assert resp.status_code == 200
    assert resp.json() == {"en": "English", "fr": "French"}


def _wav_bytes(freq=440, seconds=2.0, sr=22050):
    import numpy as np
    import soundfile as sf

    t = np.arange(int(sr * seconds)) / sr
    samples = (np.sin(2 * np.pi * freq * t) * 0.5).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, samples, sr, format="WAV")
    buf.seek(0)
    return buf


def test_mix_audio_returns_a_playable_wav(client):
    resp = client.post(
        "/mix-audio",
        files={
            "voice": ("voice.wav", _wav_bytes(seconds=3.0), "audio/wav"),
            "music": ("music.wav", _wav_bytes(seconds=1.0), "audio/wav"),
        },
        data={"voice_gain_db": 0, "music_gain_db": -10, "duck_db": 6},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert len(resp.content) > 1000  # a real WAV body, not an empty/error stub


def test_mix_audio_cleans_up_uploaded_and_output_files(client):
    from backend.config import settings

    before = set(settings.output_dir.glob("mix_*"))
    resp = client.post(
        "/mix-audio",
        files={
            "voice": ("voice.wav", _wav_bytes(seconds=1.0), "audio/wav"),
            "music": ("music.wav", _wav_bytes(seconds=1.0), "audio/wav"),
        },
    )
    assert resp.status_code == 200
    after = set(settings.output_dir.glob("mix_*"))
    assert after == before  # no leaked temp uploads or output file


def test_mix_audio_rejects_unsupported_format(client):
    resp = client.post(
        "/mix-audio",
        files={
            "voice": ("voice.m4a", _wav_bytes(), "audio/m4a"),
            "music": ("music.wav", _wav_bytes(), "audio/wav"),
        },
    )
    assert resp.status_code == 400
    assert "Unsupported voice format" in resp.json()["detail"]


def test_mix_audio_rejects_oversized_upload(client, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "max_upload_mb", 0)
    resp = client.post(
        "/mix-audio",
        files={
            "voice": ("voice.wav", _wav_bytes(seconds=1.0), "audio/wav"),
            "music": ("music.wav", _wav_bytes(seconds=1.0), "audio/wav"),
        },
    )
    assert resp.status_code == 400
    assert "exceeds" in resp.json()["detail"]
