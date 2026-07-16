"""Client for the sibling Zahra Studio voice-cloning API.

Zahra Studio (see ../voice_cloning_studio in the voice-note-script-generation
branch) runs locally and exposes a small REST API: submit a script + voice_id,
poll a job, download the resulting WAV once done. This module wraps that
contract so the video pipeline can turn a script into narration in your
already-cloned voice, then hand the audio to the render backend.

Zahra Studio must be running (``uvicorn backend.main:app --port 8000`` from
that project) before you call anything here.
"""

import time
from pathlib import Path

import requests

from .config import settings
from .exceptions import ZahraUnavailableError, ZahraVoiceError
from .logging_config import get_logger

logger = get_logger(__name__)


def _base_url() -> str:
    return settings.zahra_api_url.rstrip("/")


def _request(method: str, path: str, **kwargs):
    url = f"{_base_url()}{path}"
    try:
        resp = requests.request(method, url, timeout=settings.zahra_request_timeout, **kwargs)
    except requests.exceptions.RequestException as e:
        raise ZahraUnavailableError(
            f"Could not reach Zahra Studio at {url}. Is it running "
            f"(uvicorn backend.main:app --port 8000 in voice_cloning_studio)? ({e})"
        ) from e
    if resp.status_code >= 400:
        detail = resp.text
        try:
            detail = resp.json().get("detail", detail)
        except ValueError:
            pass
        raise ZahraVoiceError(f"Zahra Studio returned {resp.status_code}: {detail}")
    return resp


def list_voices() -> list[dict]:
    return _request("GET", "/voices").json()


def get_voice(voice_id: int) -> dict:
    return _request("GET", f"/voices/{voice_id}").json()


def generate_narration(text: str, voice_id: int, out_path: Path) -> Path:
    """Submits the script to Zahra Studio, blocks until narration is ready,
    and saves the resulting WAV to ``out_path``. Returns ``out_path``."""
    resp = _request(
        "POST",
        "/generate-speech",
        data={"text": text, "voice_id": voice_id},
    )
    job_id = resp.json()["job_id"]
    logger.info("Zahra Studio narration job %s submitted (voice_id=%s)", job_id, voice_id)

    while True:
        status = _request("GET", f"/jobs/{job_id}").json()
        if status["status"] == "done":
            break
        if status["status"] == "failed":
            raise ZahraVoiceError(f"Zahra Studio narration job {job_id} failed: {status.get('error')}")
        time.sleep(settings.zahra_poll_interval_sec)

    audio_resp = _request("GET", f"/jobs/{job_id}/download")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(audio_resp.content)
    logger.info("Narration saved to %s (%d bytes)", out_path, len(audio_resp.content))
    return out_path
