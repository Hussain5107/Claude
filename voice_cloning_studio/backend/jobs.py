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
    captions_path: Path | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="tts-worker")

    def submit(
        self,
        work: Callable[[Callable[[int, int], None]], tuple[Path, Path | None]],
        job_id: str | None = None,
        initial_chunks_done: int = 0,
        initial_chunks_total: int = 0,
    ) -> str:
        """``work`` receives an on_progress(done, total) callback and returns
        (audio_path, captions_path_or_None).

        Pass an existing ``job_id`` (with its already-known progress) when
        resuming a job whose disk-persisted chunk cache means it won't start
        from 0 -- the UI shows the real starting point immediately instead of
        a misleading jump back to 0%.
        """
        job_id = job_id or uuid.uuid4().hex
        job = Job(id=job_id, chunks_done=initial_chunks_done, chunks_total=initial_chunks_total)
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
                result_path, captions_path = work(on_progress)
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
                job.captions_path = captions_path
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
                if job.captions_path and job.captions_path.exists():
                    job.captions_path.unlink(missing_ok=True)
                del self._jobs[job.id]
        if expired:
            logger.info("Swept %d expired job(s)", len(expired))


job_manager = JobManager()
