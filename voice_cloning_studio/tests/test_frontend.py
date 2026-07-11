"""Tests for the pure-logic pieces of the Gradio frontend (queueing, estimates).

Does not start a server or touch the network -- these are plain functions
that happen to live alongside the UI wiring.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "frontend"))

import gradio_app  # noqa: E402


def test_estimate_duration_empty():
    result = gradio_app.estimate_duration("")
    assert result == "0 words -- approx 0.0 min narrated (estimate, actual pace varies)"


def test_estimate_duration_counts_words():
    text = " ".join(["word"] * gradio_app.WORDS_PER_MINUTE)  # exactly one minute's worth
    result = gradio_app.estimate_duration(text)
    assert f"{gradio_app.WORDS_PER_MINUTE} words" in result
    assert "1.0 min" in result


def test_add_to_queue_rejects_empty_text(monkeypatch):
    monkeypatch.setattr(gradio_app, "_voice_label_for_id", lambda vid: "Alice")
    queue, table, msg, cleared_text = gradio_app.add_to_queue("   ", 1, "English", 0.5, 0.5, [])
    assert queue == []
    assert "Enter script text" in msg


def test_add_to_queue_rejects_missing_voice():
    queue, table, msg, cleared_text = gradio_app.add_to_queue("hello", None, "English", 0.5, 0.5, [])
    assert queue == []
    assert "Pick a voice" in msg


def test_add_to_queue_appends_item(monkeypatch):
    monkeypatch.setattr(gradio_app, "_voice_label_for_id", lambda vid: "Alice")
    queue, table, msg, cleared_text = gradio_app.add_to_queue("hello world", 1, "English", 0.6, 0.4, [])

    assert len(queue) == 1
    item = queue[0]
    assert item["voice_label"] == "Alice"
    assert item["words"] == 2
    assert item["status"] == "queued"
    assert cleared_text == ""
    assert table == [[1, "Alice", 2, f"{2 / gradio_app.WORDS_PER_MINUTE:.1f} min", "queued", "-"]]


def test_add_to_queue_increments_index(monkeypatch):
    monkeypatch.setattr(gradio_app, "_voice_label_for_id", lambda vid: "Alice")
    queue, *_ = gradio_app.add_to_queue("first item here", 1, "English", 0.5, 0.5, [])
    queue, *_ = gradio_app.add_to_queue("second item here", 1, "English", 0.5, 0.5, queue)

    assert [item["n"] for item in queue] == [1, 2]


def _fake_item(n):
    return {
        "n": n, "voice_label": "Alice", "words": 5, "est_minutes": 0.1,
        "status": "queued", "chunks_done": 0, "chunks_total": 0,
    }


def test_remove_last():
    queue = [_fake_item(1), _fake_item(2)]
    queue, table, msg = gradio_app.remove_last(queue)
    assert [item["n"] for item in queue] == [1]


def test_remove_last_on_empty_queue_is_safe():
    queue, table, msg = gradio_app.remove_last([])
    assert queue == []


def test_clear_queue():
    queue, table, msg = gradio_app.clear_queue()
    assert queue == []
    assert table == []


def test_queue_table_shows_progress_percentage():
    queue = [{
        "n": 1, "voice_label": "Bob", "words": 10, "est_minutes": 0.1,
        "status": "running", "chunks_done": 2, "chunks_total": 4,
    }]
    table = gradio_app._queue_table(queue)
    assert table == [[1, "Bob", 10, "0.1 min", "running", "50%"]]
