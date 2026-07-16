"""In-process background job manager for the narrate-then-render pipeline.

A weekly video easily takes several minutes (cloned narration + a remote GPU
render) -- too long to hold an HTTP request open for. Jobs run on a small
background thread pool; callers poll for status/stage and download the
result once done. Mirrors the job-manager pattern used by the sibling
voice_cloning_studio project.
"""

import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from .config import settings
from .logging_config import get_logger

logger = get_logger(__name__)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.QUEUED
    stage: str = ""
    result_path: Path | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="video-worker")

    def submit(self, work: Callable[[Callable[[str], None]], Path]) -> str:
        """``work`` receives an on_stage(stage_name) callback and returns the
        path to the finished video."""
        job_id = uuid.uuid4().hex
        job = Job(id=job_id)
        with self._lock:
            self._jobs[job_id] = job

        def on_stage(stage: str) -> None:
            with self._lock:
                job.stage = stage
                job.updated_at = time.time()

        def run() -> None:
            with self._lock:
                job.status = JobStatus.RUNNING
                job.updated_at = time.time()
            logger.info("Job %s started", job_id)
            try:
                result_path = work(on_stage)
            except Exception as e:
                logger.exception("Job %s failed", job_id)
                with self._lock:
                    job.status = JobStatus.FAILED
                    job.error = str(e) or type(e).__name__
                    job.updated_at = time.time()
                return
            with self._lock:
                job.status = JobStatus.DONE
                job.result_path = result_path
                job.updated_at = time.time()
            logger.info("Job %s finished", job_id)

        self._executor.submit(run)
        return job_id

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def sweep_expired(self) -> None:
        cutoff = time.time() - settings.job_retention_seconds
        with self._lock:
            expired = [
                j for j in self._jobs.values()
                if j.status in (JobStatus.DONE, JobStatus.FAILED) and j.updated_at < cutoff
            ]
            for job in expired:
                if job.result_path and job.result_path.exists():
                    job.result_path.unlink(missing_ok=True)
                del self._jobs[job.id]
        if expired:
            logger.info("Swept %d expired job(s)", len(expired))


job_manager = JobManager()
