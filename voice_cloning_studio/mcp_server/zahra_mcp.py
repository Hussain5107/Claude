"""MCP bridge: lets Claude Desktop talk to a locally-running Zahra Studio backend.

Write a script and narrate it in one Claude conversation. This is a thin
HTTP client wrapping the FastAPI backend's own API -- it has no ML
dependencies itself (no torch/chatterbox), just `mcp` and `requests`, so it
starts instantly regardless of how the main backend is set up.

Requires the Zahra Studio backend to already be running (start_backend.bat /
start_backend.sh) at ZAHRA_API_BASE (default http://localhost:8000).
"""

import os
import time
from pathlib import Path

import requests
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("ZAHRA_API_BASE", "http://localhost:8000")
OUTPUT_DIR = Path(os.environ.get("ZAHRA_MCP_OUTPUT_DIR", str(Path.home() / "ZahraStudioNarrations")))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

mcp = FastMCP("zahra-studio")


def _error_detail(resp: requests.Response) -> str:
    try:
        return resp.json().get("detail", resp.text)
    except ValueError:
        return resp.text


def _find_voice(name_or_id: str) -> dict | None:
    resp = requests.get(f"{API_BASE}/voices", timeout=10)
    resp.raise_for_status()
    for voice in resp.json():
        if str(voice["id"]) == str(name_or_id) or voice["name"].lower() == str(name_or_id).lower():
            return voice
    return None


@mcp.tool()
def list_voices() -> list[dict]:
    """List every cloned voice saved in Zahra Studio, including any saved
    default exaggeration/pace/language settings for each."""
    resp = requests.get(f"{API_BASE}/voices", timeout=10)
    resp.raise_for_status()
    return resp.json()


@mcp.tool()
def clone_voice_from_file(audio_file_path: str, voice_name: str) -> dict:
    """Clone a new voice in Zahra Studio from a local audio file (wav/mp3/m4a/flac/ogg/aac).

    Only use this with a reference clip you have the right to clone: your
    own voice, or a voice you have explicit permission to use. If there's
    any doubt about whose voice this is or whether cloning it is authorized,
    ask the user to confirm before calling this tool.
    """
    path = Path(audio_file_path).expanduser()
    if not path.exists():
        raise FileNotFoundError(f"No such file: {audio_file_path}")

    with path.open("rb") as f:
        resp = requests.post(
            f"{API_BASE}/clone-voice",
            data={"name": voice_name},
            files={"audio": (path.name, f)},
            timeout=600,
        )
    if resp.status_code != 200:
        raise RuntimeError(_error_detail(resp))
    return resp.json()


@mcp.tool()
def submit_narration(
    text: str,
    voice_name: str,
    language: str = "en",
    exaggeration: float | None = None,
    cfg_weight: float | None = None,
) -> dict:
    """Submit a script to be narrated in a saved cloned voice. Returns immediately
    with a job_id -- narration runs in the background. Use wait_for_narration
    (for short text) or check_narration_status + get_narration_result (for
    longer scripts) to retrieve the finished audio.

    voice_name can be the voice's name or its numeric id -- call list_voices
    first if unsure what's available. language is an ISO code (e.g. "en",
    "es", "fr"); omit exaggeration/cfg_weight to use that voice's saved
    defaults if it has any.
    """
    voice = _find_voice(voice_name)
    if voice is None:
        raise ValueError(f"No saved voice named '{voice_name}'. Call list_voices to see what's available.")

    data = {"text": text, "voice_id": voice["id"], "language": language}
    if exaggeration is not None:
        data["exaggeration"] = exaggeration
    if cfg_weight is not None:
        data["cfg_weight"] = cfg_weight

    resp = requests.post(f"{API_BASE}/generate-speech", data=data, timeout=30)
    if resp.status_code != 202:
        raise RuntimeError(_error_detail(resp))

    words = len(text.split())
    return {
        "job_id": resp.json()["job_id"],
        "voice": voice["name"],
        "estimated_minutes": round(words / 140, 1),
    }


@mcp.tool()
def check_narration_status(job_id: str) -> dict:
    """Check progress of a narration job started with submit_narration."""
    resp = requests.get(f"{API_BASE}/jobs/{job_id}", timeout=10)
    resp.raise_for_status()
    job = resp.json()
    percent = int(100 * job["chunks_done"] / job["chunks_total"]) if job["chunks_total"] else 0
    return {**job, "percent": percent}


@mcp.tool()
def wait_for_narration(job_id: str, timeout_seconds: int = 120) -> dict:
    """Block and poll until a narration job finishes or the timeout is hit.

    Good for short test sentences (usually done well within the default
    timeout). For full-length scripts, don't use this -- submit the job,
    tell the user it's running, and check back with check_narration_status
    later instead of blocking the conversation.
    """
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        status = check_narration_status(job_id)
        if status["status"] in ("done", "failed"):
            return status
        time.sleep(2)
    return {
        "status": "timeout",
        "message": f"Still running after {timeout_seconds}s. Use check_narration_status to keep checking.",
    }


@mcp.tool()
def get_narration_result(job_id: str) -> dict:
    """Download the finished audio (and captions, if generated) for a completed
    job into a local folder, returning file paths on this computer."""
    status = check_narration_status(job_id)
    if status["status"] != "done":
        raise RuntimeError(f"Job is not finished yet (status={status['status']}).")

    audio_resp = requests.get(f"{API_BASE}/jobs/{job_id}/download", timeout=120)
    audio_resp.raise_for_status()
    audio_path = OUTPUT_DIR / f"{job_id}.wav"
    audio_path.write_bytes(audio_resp.content)

    result = {"audio_path": str(audio_path)}
    if status.get("has_captions"):
        captions_resp = requests.get(f"{API_BASE}/jobs/{job_id}/captions", timeout=30)
        if captions_resp.status_code == 200:
            captions_path = OUTPUT_DIR / f"{job_id}.srt"
            captions_path.write_bytes(captions_resp.content)
            result["captions_path"] = str(captions_path)
    return result


if __name__ == "__main__":
    mcp.run()
