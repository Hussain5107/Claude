"""
Web Content Downloader — a small local web UI over yt-dlp / gallery-dl.

Run locally (python app.py) and open http://127.0.0.1:5000. It is NOT meant
to be exposed to the public internet: it accepts arbitrary URLs and shells
out to download tools, which is fine for a tool only you can reach, but not
safe as a public service. See README.md for the full explanation, including
why Scribd (and other paywalled/DRM document sites) are deliberately not
supported.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import threading
import uuid
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import requests
from flask import Flask, Response, jsonify, render_template, request, send_file

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)

# job_id -> {status, message, percent, file, error}
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()

ALLOWED_SCHEMES = {"http", "https"}

# Sites where "downloading" really means defeating a paywall/DRM viewer
# rather than fetching content the user already has the right to. We refuse
# these explicitly instead of silently trying and failing in a confusing way.
BLOCKED_HOSTS = {
    "scribd.com",
    "www.scribd.com",
}


def _job_update(job_id: str, **kwargs):
    with JOBS_LOCK:
        JOBS[job_id].update(kwargs)


def _validate_url(url: str) -> str | None:
    """Return an error message if the URL should be rejected, else None."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return "That doesn't look like a valid URL."

    if parsed.scheme not in ALLOWED_SCHEMES:
        return "Only http:// and https:// URLs are supported."
    if not parsed.netloc:
        return "That doesn't look like a valid URL."
    host = parsed.netloc.lower().split("@")[-1].split(":")[0]
    if host in BLOCKED_HOSTS:
        return (
            "Scribd documents are protected by a paywall/DRM viewer, not a "
            "plain download link. Downloading paid content that way would "
            "circumvent Scribd's access controls, which this tool won't do. "
            "If you have a Scribd subscription, use Scribd's own Download "
            "button; if it's your own document, get it from your original "
            "copy; if it's public-domain, look for it on archive.org."
        )
    return None


def _job_dir(job_id: str) -> Path:
    d = DOWNLOAD_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _run_ytdlp(job_id: str, url: str, mode: str):
    import yt_dlp

    out_dir = _job_dir(job_id)
    fmt = {
        "video": "bv*[ext=mp4]+ba[ext=m4a]/best[ext=mp4]/best",
        "best": "best",
    }.get(mode, "best")

    def hook(d):
        if d["status"] == "downloading":
            pct = re.sub(r"\x1b\[[0-9;]*m", "", d.get("_percent_str", "")).strip()
            _job_update(job_id, status="downloading", message=f"Downloading… {pct}")
        elif d["status"] == "finished":
            _job_update(job_id, status="processing", message="Finalizing…")

    ydl_opts = {
        "outtmpl": str(out_dir / "%(title).150B [%(id)s].%(ext)s"),
        "format": fmt,
        "noplaylist": True,
        "progress_hooks": [hook],
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": False,
    }
    if mode == "audio":
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    _finish_from_dir(job_id, out_dir)


def _run_gallerydl(job_id: str, url: str):
    out_dir = _job_dir(job_id)
    _job_update(job_id, status="downloading", message="Downloading gallery…")

    proc = subprocess.run(
        ["gallery-dl", "--dest", str(out_dir), url],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip()[-800:] or "gallery-dl failed")

    _finish_from_dir(job_id, out_dir)


def _run_direct_file(job_id: str, url: str):
    out_dir = _job_dir(job_id)
    _job_update(job_id, status="downloading", message="Downloading file…")

    name = Path(urlparse(url).path).name or "download"
    dest = out_dir / name

    with requests.get(url, stream=True, timeout=30) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        done = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 16):
                if not chunk:
                    continue
                f.write(chunk)
                done += len(chunk)
                if total:
                    pct = f"{done * 100 // total}%"
                    _job_update(job_id, message=f"Downloading… {pct}")

    _finish_from_dir(job_id, out_dir)


def _finish_from_dir(job_id: str, out_dir: Path):
    files = [p for p in out_dir.rglob("*") if p.is_file()]
    if not files:
        raise RuntimeError("No file was produced. The link may be private, "
                            "region-locked, or not supported.")

    if len(files) == 1:
        final = files[0]
    else:
        zip_path = out_dir / "download.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in files:
                zf.write(p, p.name)
        final = zip_path

    _job_update(
        job_id,
        status="done",
        message="Done",
        file=str(final.relative_to(DOWNLOAD_DIR)),
    )


def _worker(job_id: str, url: str, engine: str, mode: str):
    try:
        if engine == "ytdlp":
            _run_ytdlp(job_id, url, mode)
        elif engine == "gallerydl":
            _run_gallerydl(job_id, url)
        elif engine == "file":
            _run_direct_file(job_id, url)
        else:
            raise ValueError(f"Unknown engine: {engine}")
    except Exception as exc:  # noqa: BLE001 — surface any failure to the UI
        shutil.rmtree(_job_dir(job_id), ignore_errors=True)
        _job_update(job_id, status="error", message="Failed", error=str(exc)[:800])


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/download")
def start_download():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    engine = data.get("engine", "ytdlp")
    mode = data.get("mode", "best")

    if not url:
        return jsonify(error="Please paste a URL."), 400
    if engine not in ("ytdlp", "gallerydl", "file"):
        return jsonify(error="Invalid engine."), 400

    err = _validate_url(url)
    if err:
        return jsonify(error=err), 400

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {"status": "queued", "message": "Queued…", "file": None, "error": None}

    thread = threading.Thread(target=_worker, args=(job_id, url, engine, mode), daemon=True)
    thread.start()

    return jsonify(job_id=job_id)


@app.get("/api/status/<job_id>")
def status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return jsonify(error="Unknown job."), 404
    return jsonify(**job)


@app.get("/api/file/<job_id>")
def get_file(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job or job.get("status") != "done" or not job.get("file"):
        return jsonify(error="File not ready."), 404

    path = (DOWNLOAD_DIR / job["file"]).resolve()
    if DOWNLOAD_DIR.resolve() not in path.parents:
        return jsonify(error="Invalid path."), 400

    return send_file(path, as_attachment=True, download_name=path.name)


if __name__ == "__main__":
    # Bind to localhost only — this app is not hardened for public exposure.
    app.run(host="127.0.0.1", port=5000, debug=False)
