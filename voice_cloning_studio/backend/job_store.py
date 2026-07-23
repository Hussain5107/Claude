"""Disk-persisted job state, so a long generation survives a crash/restart.

JobManager (jobs.py) is pure in-memory -- fine for progress polling while the
backend is alive, but a 60-chunk job that dies partway (crash, OOM, closed
terminal, laptop sleep) loses everything with it, since nothing on disk
records what was already generated.

This module writes one manifest per job (the inputs: text, voice, settings,
and the exact chunk list) plus each chunk's finished audio as it completes.
Resuming a job means: reload the manifest, re-run generation, and skip any
chunk whose audio file already exists on disk -- so only the chunks that
never finished get regenerated, and results already computed are never lost.
"""

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from .config import settings

MANIFEST_NAME = "manifest.json"


@dataclass
class ChunkSpec:
    text: str
    is_paragraph_end: bool
    language_id: str


def jobs_root() -> Path:
    root = settings.output_dir / "jobs"
    root.mkdir(parents=True, exist_ok=True)
    return root


def job_dir(job_id: str) -> Path:
    return jobs_root() / job_id


def chunks_dir(job_id: str) -> Path:
    d = job_dir(job_id) / "chunks"
    d.mkdir(parents=True, exist_ok=True)
    return d


def chunk_audio_path(job_id: str, index: int) -> Path:
    return chunks_dir(job_id) / f"{index:05d}.wav"


def write_manifest(
    job_id: str,
    *,
    voice_id: int,
    embedding_path: str,
    language_id: str,
    exaggeration: float,
    cfg_weight: float,
    temperature: float,
    text: str,
    chunks: list[ChunkSpec],
) -> None:
    manifest = {
        "job_id": job_id,
        "created_at": time.time(),
        "voice_id": voice_id,
        "embedding_path": embedding_path,
        "language_id": language_id,
        "exaggeration": exaggeration,
        "cfg_weight": cfg_weight,
        "temperature": temperature,
        "text": text,
        "chunks": [asdict(c) for c in chunks],
    }
    job_dir(job_id).mkdir(parents=True, exist_ok=True)
    (job_dir(job_id) / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def load_manifest(job_id: str) -> dict | None:
    path = job_dir(job_id) / MANIFEST_NAME
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def chunks_done_count(job_id: str, total: int) -> int:
    done = 0
    for i in range(total):
        if chunk_audio_path(job_id, i).exists():
            done += 1
        else:
            break  # chunks are generated in order; first gap is where resume continues
    return done


def list_resumable_jobs() -> list[dict]:
    """Jobs whose manifest still exists -- a completed job's manifest is
    deleted (see cleanup_job_dir), so any manifest found here belongs to a
    job that was interrupted before finishing, whether by an error or the
    backend process dying outright."""
    resumable = []
    for d in jobs_root().iterdir():
        if not d.is_dir():
            continue
        manifest = load_manifest(d.name)
        if manifest is None:
            continue
        total = len(manifest["chunks"])
        manifest["chunks_done"] = chunks_done_count(d.name, total)
        manifest["chunks_total"] = total
        resumable.append(manifest)
    return sorted(resumable, key=lambda m: m["created_at"], reverse=True)


def cleanup_job_dir(job_id: str) -> None:
    import shutil

    d = job_dir(job_id)
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)


def sweep_expired_jobs() -> None:
    cutoff = time.time() - settings.job_retention_seconds
    for d in jobs_root().iterdir():
        if not d.is_dir():
            continue
        manifest = load_manifest(d.name)
        if manifest is not None and manifest.get("created_at", 0) < cutoff:
            cleanup_job_dir(d.name)
