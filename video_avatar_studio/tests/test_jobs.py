import time
from pathlib import Path

from backend.jobs import JobManager, JobStatus


def test_job_succeeds_and_reports_stages(tmp_path):
    manager = JobManager()
    seen_stages = []

    def work(on_stage):
        on_stage("narrating")
        seen_stages.append("narrating")
        on_stage("rendering")
        seen_stages.append("rendering")
        result = tmp_path / "out.mp4"
        result.write_bytes(b"video")
        return result

    job_id = manager.submit(work)
    for _ in range(50):
        job = manager.get(job_id)
        if job.status == JobStatus.DONE:
            break
        time.sleep(0.05)

    assert job.status == JobStatus.DONE
    assert job.result_path.read_bytes() == b"video"
    assert seen_stages == ["narrating", "rendering"]


def test_job_records_failure():
    manager = JobManager()

    def work(_on_stage):
        raise RuntimeError("render exploded")

    job_id = manager.submit(work)
    for _ in range(50):
        job = manager.get(job_id)
        if job.status == JobStatus.FAILED:
            break
        time.sleep(0.05)

    assert job.status == JobStatus.FAILED
    assert "render exploded" in job.error


def test_get_missing_job_returns_none():
    manager = JobManager()
    assert manager.get("nonexistent") is None
