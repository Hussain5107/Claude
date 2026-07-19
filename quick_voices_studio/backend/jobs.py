"""Background job tracking for speech generation, mirroring the main app's pattern."""

import logging
import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from .config import settings
from .exceptions import JobNotFoundError

logger = logging.getLogger("quick_voices.jobs")


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.QUEUED
    chunks_done: int = 0
    chunks_total: int = 0
    result_path: Path | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)

    def submit(self, work: Callable[[Job], Path]) -> str:
        job = Job(id=str(uuid.uuid4()))
        with self._lock:
            self._jobs[job.id] = job
        self._executor.submit(self._run, job, work)
        return job.id

    def _run(self, job: Job, work: Callable[[Job], Path]) -> None:
        job.status = JobStatus.RUNNING
        try:
            job.result_path = work(job)
            job.status = JobStatus.DONE
        except Exception as exc:  # noqa: BLE001 - reported via job status, not raised in a thread
            logger.exception("Job %s failed", job.id)
            job.status = JobStatus.FAILED
            job.error = str(exc)

    def get(self, job_id: str) -> Job:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            raise JobNotFoundError(f"No such job: {job_id}")
        return job

    def sweep_expired(self) -> None:
        cutoff = time.time() - settings.job_retention_seconds
        with self._lock:
            expired = [jid for jid, j in self._jobs.items() if j.created_at < cutoff]
            for jid in expired:
                del self._jobs[jid]


job_manager = JobManager()
