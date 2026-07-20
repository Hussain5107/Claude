import json
import time

from backend import job_store


def _write_sample_manifest(job_id, n_chunks=3, voice_id=1):
    job_store.write_manifest(
        job_id,
        voice_id=voice_id,
        embedding_path="/fake/embedding.pt",
        language_id="en",
        exaggeration=0.5,
        cfg_weight=0.5,
        text="Sentence one. Sentence two. Sentence three.",
        chunks=[
            job_store.ChunkSpec(text=f"Sentence {i}.", is_paragraph_end=False, language_id="en")
            for i in range(n_chunks)
        ],
    )


def test_write_and_load_manifest_round_trips():
    _write_sample_manifest("job-a")
    manifest = job_store.load_manifest("job-a")
    assert manifest["voice_id"] == 1
    assert len(manifest["chunks"]) == 3
    assert manifest["chunks"][1]["text"] == "Sentence 1."


def test_load_manifest_missing_returns_none():
    assert job_store.load_manifest("does-not-exist") is None


def test_chunk_audio_path_is_stable_and_zero_padded():
    p1 = job_store.chunk_audio_path("job-b", 3)
    p2 = job_store.chunk_audio_path("job-b", 3)
    assert p1 == p2
    assert p1.name == "00003.wav"


def test_chunks_done_count_stops_at_first_gap():
    job_id = "job-c"
    job_store.chunk_audio_path(job_id, 0).write_bytes(b"fake")
    job_store.chunk_audio_path(job_id, 1).write_bytes(b"fake")
    # chunk 2 missing -- generation would resume here
    job_store.chunk_audio_path(job_id, 3).write_bytes(b"fake")  # a stray later file shouldn't count

    assert job_store.chunks_done_count(job_id, total=5) == 2


def test_chunks_done_count_all_present():
    job_id = "job-d"
    for i in range(4):
        job_store.chunk_audio_path(job_id, i).write_bytes(b"fake")
    assert job_store.chunks_done_count(job_id, total=4) == 4


def test_list_resumable_jobs_excludes_jobs_cleaned_up_after_success():
    _write_sample_manifest("job-e")
    job_store.chunk_audio_path("job-e", 0).write_bytes(b"fake")

    _write_sample_manifest("job-f")
    job_store.cleanup_job_dir("job-f")  # what a successful job's completion does

    resumable_ids = {m["job_id"] for m in job_store.list_resumable_jobs()}
    assert "job-e" in resumable_ids
    assert "job-f" not in resumable_ids


def test_list_resumable_jobs_reports_progress():
    job_id = "job-g"
    _write_sample_manifest(job_id, n_chunks=5)
    job_store.chunk_audio_path(job_id, 0).write_bytes(b"fake")
    job_store.chunk_audio_path(job_id, 1).write_bytes(b"fake")

    entries = [m for m in job_store.list_resumable_jobs() if m["job_id"] == job_id]
    assert len(entries) == 1
    assert entries[0]["chunks_done"] == 2
    assert entries[0]["chunks_total"] == 5


def test_cleanup_job_dir_removes_manifest_and_chunks():
    job_id = "job-h"
    _write_sample_manifest(job_id)
    job_store.chunk_audio_path(job_id, 0).write_bytes(b"fake")

    job_store.cleanup_job_dir(job_id)

    assert job_store.load_manifest(job_id) is None
    assert not job_store.job_dir(job_id).exists()


def test_cleanup_job_dir_on_missing_job_is_a_noop():
    job_store.cleanup_job_dir("never-existed")  # must not raise


def test_sweep_expired_jobs_removes_old_but_keeps_recent(monkeypatch):
    from backend.config import settings

    _write_sample_manifest("job-old")
    _write_sample_manifest("job-new")

    old_manifest_path = job_store.job_dir("job-old") / job_store.MANIFEST_NAME
    manifest = job_store.load_manifest("job-old")
    manifest["created_at"] = time.time() - 100_000
    old_manifest_path.write_text(json.dumps(manifest))

    monkeypatch.setattr(settings, "job_retention_seconds", 3600)
    job_store.sweep_expired_jobs()

    assert job_store.load_manifest("job-old") is None
    assert job_store.load_manifest("job-new") is not None
