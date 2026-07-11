"""In-process background job manager for long-running generation requests.

Generation of a 30-60 minute script can take a long time on CPU -- far
longer than is reasonable to hold an HTTP request open for. Jobs run on a
single-worker background thread (the model itself is not safely usable from
multiple threads concurrently, and CPU-bound generation wouldn't parallelize
usefully on typical hardware anyway); callers poll for status/progress and
fetch the result once done.
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
    chunks_done: int = 0
    chunks_total: int = 0
    result_path: Path | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tts-worker")

    def submit(self, work: Callable[[Callable[[int, int], None]], Path]) -> str:
        job_id = uuid.uuid4().hex
        job = Job(id=job_id)
        with self._lock:
            self._jobs[job_id] = job

        def on_progress(done: int, total: int) -> None:
            with self._lock:
                job.chunks_done = done
                job.chunks_total = total
                job.updated_at = time.time()

        def run() -> None:
            with self._lock:
                job.status = JobStatus.RUNNING
                job.updated_at = time.time()
            logger.info("Job %s started", job_id)
            try:
                result_path = work(on_progress)
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
        """Drops finished jobs older than the retention window, deleting their output files."""
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
