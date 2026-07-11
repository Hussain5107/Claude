import time

from backend.jobs import JobManager, JobStatus


def test_job_completes_successfully(tmp_path):
    manager = JobManager()
    result_path = tmp_path / "out.wav"
    captions_path = tmp_path / "out.srt"

    def work(on_progress):
        on_progress(1, 2)
        on_progress(2, 2)
        result_path.write_bytes(b"fake audio")
        captions_path.write_text("1\n00:00:00,000 --> 00:00:01,000\nhi\n")
        return result_path, captions_path

    job_id = manager.submit(work)
    job = _wait_for_terminal(manager, job_id)

    assert job.status == JobStatus.DONE
    assert job.result_path == result_path
    assert job.captions_path == captions_path
    assert job.chunks_done == 2
    assert job.chunks_total == 2


def test_job_works_without_captions(tmp_path):
    manager = JobManager()
    result_path = tmp_path / "out.wav"

    def work(on_progress):
        result_path.write_bytes(b"fake audio")
        return result_path, None

    job_id = manager.submit(work)
    job = _wait_for_terminal(manager, job_id)

    assert job.status == JobStatus.DONE
    assert job.result_path == result_path
    assert job.captions_path is None


def test_job_records_failure():
    manager = JobManager()

    def work(on_progress):
        raise RuntimeError("synthesis exploded")

    job_id = manager.submit(work)
    job = _wait_for_terminal(manager, job_id)

    assert job.status == JobStatus.FAILED
    assert "synthesis exploded" in job.error


def test_unknown_job_returns_none():
    manager = JobManager()
    assert manager.get("does-not-exist") is None


def test_sweep_expired_removes_old_finished_jobs(tmp_path, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "job_retention_seconds", 0)
    manager = JobManager()
    result_path = tmp_path / "out.wav"
    captions_path = tmp_path / "out.srt"

    def work(on_progress):
        result_path.write_bytes(b"x")
        captions_path.write_text("x")
        return result_path, captions_path

    job_id = manager.submit(work)
    _wait_for_terminal(manager, job_id)

    time.sleep(0.05)
    manager.sweep_expired()

    assert manager.get(job_id) is None
    assert not result_path.exists()
    assert not captions_path.exists()


def _wait_for_terminal(manager: JobManager, job_id: str, timeout: float = 5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = manager.get(job_id)
        if job.status in (JobStatus.DONE, JobStatus.FAILED):
            return job
        time.sleep(0.02)
    raise TimeoutError("job did not finish in time")
