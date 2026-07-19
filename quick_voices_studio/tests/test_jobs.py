import time
from pathlib import Path

import pytest

from backend.exceptions import JobNotFoundError
from backend.jobs import JobManager, JobStatus


def test_submit_runs_work_and_marks_done(tmp_path):
    manager = JobManager()
    result_path = tmp_path / "out.wav"
    result_path.write_bytes(b"fake")

    def work(job):
        job.chunks_done, job.chunks_total = 1, 1
        return result_path

    job_id = manager.submit(work)
    for _ in range(50):
        if manager.get(job_id).status in (JobStatus.DONE, JobStatus.FAILED):
            break
        time.sleep(0.02)

    job = manager.get(job_id)
    assert job.status == JobStatus.DONE
    assert job.result_path == result_path
    assert job.chunks_done == 1


def test_submit_marks_failed_on_exception():
    manager = JobManager()

    def work(job):
        raise RuntimeError("synthesis exploded")

    job_id = manager.submit(work)
    for _ in range(50):
        if manager.get(job_id).status in (JobStatus.DONE, JobStatus.FAILED):
            break
        time.sleep(0.02)

    job = manager.get(job_id)
    assert job.status == JobStatus.FAILED
    assert "synthesis exploded" in job.error


def test_get_unknown_job_raises():
    manager = JobManager()
    with pytest.raises(JobNotFoundError):
        manager.get("does-not-exist")


def test_sweep_expired_removes_old_jobs(monkeypatch):
    from backend.config import settings

    manager = JobManager()
    job_id = manager.submit(lambda job: Path("/dev/null"))
    time.sleep(0.05)

    monkeypatch.setattr(settings, "job_retention_seconds", 0)
    manager.sweep_expired()

    with pytest.raises(JobNotFoundError):
        manager.get(job_id)
