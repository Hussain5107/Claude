import io
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_create_and_list_avatar(client):
    resp = client.post(
        "/avatars",
        data={"name": "me"},
        files={"image": ("me.jpg", io.BytesIO(b"fakejpegdata"), "image/jpeg")},
    )
    assert resp.status_code == 200
    avatar = resp.json()
    assert avatar["name"] == "me"

    list_resp = client.get("/avatars")
    assert list_resp.status_code == 200
    assert any(a["name"] == "me" for a in list_resp.json())


def test_create_avatar_rejects_bad_extension(client):
    resp = client.post(
        "/avatars",
        data={"name": "me"},
        files={"image": ("me.gif", io.BytesIO(b"data"), "image/gif")},
    )
    assert resp.status_code == 400


def test_create_avatar_rejects_duplicate_name(client):
    files = {"image": ("me.jpg", io.BytesIO(b"data"), "image/jpeg")}
    client.post("/avatars", data={"name": "dup"}, files=files)
    resp = client.post("/avatars", data={"name": "dup"}, files=files)
    assert resp.status_code == 409


def test_delete_avatar(client):
    resp = client.post(
        "/avatars",
        data={"name": "todelete"},
        files={"image": ("me.jpg", io.BytesIO(b"data"), "image/jpeg")},
    )
    avatar_id = resp.json()["id"]
    del_resp = client.delete(f"/avatars/{avatar_id}")
    assert del_resp.status_code == 200
    assert client.get(f"/avatars/{avatar_id}").status_code == 404


def test_generate_video_requires_existing_avatar(client):
    resp = client.post(
        "/generate-video",
        data={"script": "hello", "avatar_id": 999, "voice_id": 1},
    )
    assert resp.status_code == 404


def test_generate_video_rejects_empty_script(client):
    resp = client.post(
        "/avatars",
        data={"name": "scripttest"},
        files={"image": ("me.jpg", io.BytesIO(b"data"), "image/jpeg")},
    )
    avatar_id = resp.json()["id"]
    bad_resp = client.post(
        "/generate-video",
        data={"script": "   ", "avatar_id": avatar_id, "voice_id": 1},
    )
    assert bad_resp.status_code == 400


def test_generate_video_queues_job_and_reports_status(client):
    resp = client.post(
        "/avatars",
        data={"name": "jobtest"},
        files={"image": ("me.jpg", io.BytesIO(b"data"), "image/jpeg")},
    )
    avatar_id = resp.json()["id"]

    with patch("backend.main.pipeline.generate_video") as mock_generate:
        mock_generate.return_value = __import__("pathlib").Path("/tmp/does-not-matter.mp4")
        submit_resp = client.post(
            "/generate-video",
            data={"script": "hello world", "avatar_id": avatar_id, "voice_id": 1},
        )
    assert submit_resp.status_code == 202
    job_id = submit_resp.json()["job_id"]

    import time
    for _ in range(50):
        status = client.get(f"/jobs/{job_id}").json()
        if status["status"] != "queued" and status["status"] != "running":
            break
        time.sleep(0.05)
    assert status["status"] in ("done", "failed")


def test_voices_proxies_zahra_client(client):
    with patch("backend.main.zahra_client.list_voices", return_value=[{"id": 1, "name": "me"}]):
        resp = client.get("/voices")
    assert resp.status_code == 200
    assert resp.json() == [{"id": 1, "name": "me"}]
