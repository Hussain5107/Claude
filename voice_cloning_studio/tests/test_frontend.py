"""Tests for the pure-logic pieces of the Gradio frontend (queueing, estimates).

Does not start a server or touch the network -- these are plain functions
that happen to live alongside the UI wiring.
"""

import sys
from pathlib import Path

import pytest

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


def test_estimate_duration_ignores_language_tag_markup():
    result = gradio_app.estimate_duration("Hi. [fr]Bonjour le monde.[/fr] Bye.")
    assert "5 words" in result  # tags themselves aren't counted as words


def test_add_to_queue_rejects_empty_text(monkeypatch):
    monkeypatch.setattr(gradio_app, "_voice_label_for_id", lambda vid: "Alice")
    queue, table, msg, cleared_text = gradio_app.add_to_queue("   ", 1, "English", 0.5, 0.5, 0.8, [])
    assert queue == []
    assert "Enter script text" in msg


def test_add_to_queue_rejects_missing_voice():
    queue, table, msg, cleared_text = gradio_app.add_to_queue("hello", None, "English", 0.5, 0.5, 0.8, [])
    assert queue == []
    assert "Pick a voice" in msg


def test_add_to_queue_appends_item(monkeypatch):
    monkeypatch.setattr(gradio_app, "_voice_label_for_id", lambda vid: "Alice")
    queue, table, msg, cleared_text = gradio_app.add_to_queue("hello world", 1, "English", 0.6, 0.4, 0.9, [])

    assert len(queue) == 1
    item = queue[0]
    assert item["voice_label"] == "Alice"
    assert item["words"] == 2
    assert item["status"] == "queued"
    assert item["temperature"] == 0.9
    assert cleared_text == ""
    assert table == [[1, "Alice", 2, f"{2 / gradio_app.WORDS_PER_MINUTE:.1f} min", "queued", "-"]]


def test_add_to_queue_increments_index(monkeypatch):
    monkeypatch.setattr(gradio_app, "_voice_label_for_id", lambda vid: "Alice")
    queue, *_ = gradio_app.add_to_queue("first item here", 1, "English", 0.5, 0.5, 0.8, [])
    queue, *_ = gradio_app.add_to_queue("second item here", 1, "English", 0.5, 0.5, 0.8, queue)

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


def test_move_item_up():
    queue = [_fake_item(1), _fake_item(2)]
    queue[0]["voice_label"], queue[1]["voice_label"] = "First", "Second"
    queue, table, msg = gradio_app.move_item(2, -1, queue)
    assert [item["voice_label"] for item in queue] == ["Second", "First"]
    assert [item["n"] for item in queue] == [1, 2]


def test_move_item_down():
    queue = [_fake_item(1), _fake_item(2)]
    queue[0]["voice_label"], queue[1]["voice_label"] = "First", "Second"
    queue, table, msg = gradio_app.move_item(1, 1, queue)
    assert [item["voice_label"] for item in queue] == ["Second", "First"]


def test_move_item_out_of_range_is_noop():
    queue = [_fake_item(1), _fake_item(2)]
    queue, table, msg = gradio_app.move_item(1, -1, queue)  # can't move first item up
    assert [item["n"] for item in queue] == [1, 2]
    assert "Can't move" in msg


def test_load_item_for_editing_removes_and_renumbers(monkeypatch):
    monkeypatch.setattr(gradio_app, "_voice_label_for_id", lambda vid: "Alice")
    queue, *_ = gradio_app.add_to_queue("first text", 1, "English", 0.6, 0.4, 0.9, [])
    queue, *_ = gradio_app.add_to_queue("second text", 1, "English", 0.5, 0.5, 0.8, queue)

    queue, table, msg, text, voice_id, lang, exag, cfg, temp = gradio_app.load_item_for_editing(1, queue)

    assert text == "first text"
    assert voice_id == 1
    assert exag == 0.6
    assert cfg == 0.4
    assert temp == 0.9
    assert [item["n"] for item in queue] == [1]  # remaining item renumbered
    assert queue[0]["text"] == "second text"


def test_load_item_for_editing_invalid_index():
    result = gradio_app.load_item_for_editing(5, [_fake_item(1)])
    queue, msg = result[0], result[2]
    assert len(queue) == 1
    assert "Invalid item number" in msg


def test_fetch_voice_defaults_returns_none_when_unset(monkeypatch):
    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"default_exaggeration": None}

    monkeypatch.setattr(gradio_app.requests, "get", lambda *a, **k: FakeResp())
    assert gradio_app.fetch_voice_defaults(1) is None


def test_fetch_voice_defaults_returns_saved_values(monkeypatch):
    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"default_exaggeration": 0.7, "default_cfg_weight": 0.3, "default_language": "fr"}

    monkeypatch.setattr(gradio_app.requests, "get", lambda *a, **k: FakeResp())
    result = gradio_app.fetch_voice_defaults(1)
    assert result == (0.7, 0.3, "French")


def test_apply_voice_defaults_falls_back_when_none(monkeypatch):
    monkeypatch.setattr(gradio_app, "fetch_voice_defaults", lambda vid: None)
    result = gradio_app.apply_voice_defaults(1, 0.5, 0.5, "English")
    assert result == (0.5, 0.5, "English")


def test_apply_voice_defaults_uses_saved_values(monkeypatch):
    monkeypatch.setattr(gradio_app, "fetch_voice_defaults", lambda vid: (0.8, 0.2, "German"))
    result = gradio_app.apply_voice_defaults(1, 0.5, 0.5, "English")
    assert result == (0.8, 0.2, "German")


def test_progress_bar_html_shows_rounded_percent_and_label():
    html = gradio_app._progress_bar_html(42.5, "chunk 5/12")
    assert "42%" in html
    assert "chunk 5/12" in html
    assert "width:42.5%" in html


def test_progress_bar_html_clamps_out_of_range_values():
    assert "width:0.0%" in gradio_app._progress_bar_html(-10, "x")
    assert "width:100.0%" in gradio_app._progress_bar_html(150, "x")


def _fake_batch_item(status, chunks_done=0, chunks_total=0):
    return {
        "n": 1, "voice_id": 1, "voice_label": "Alice",
        "status": status, "chunks_done": chunks_done, "chunks_total": chunks_total,
    }


def test_batch_progress_all_queued_is_zero():
    queue = [_fake_batch_item("queued"), _fake_batch_item("queued")]
    pct, label = gradio_app._batch_progress(queue)
    assert pct == 0.0
    assert "0/2" in label


def test_batch_progress_combines_finished_items_and_current_chunk_progress():
    queue = [
        _fake_batch_item("done", 4, 4),
        _fake_batch_item("running", 2, 8),
        _fake_batch_item("queued"),
    ]
    pct, label = gradio_app._batch_progress(queue)
    assert pct == pytest.approx(41.666, abs=0.01)
    assert "Item 2/3" in label
    assert "chunk 2/8" in label


def test_batch_progress_all_done_is_100():
    queue = [_fake_batch_item("done", 4, 4), _fake_batch_item("done", 2, 2)]
    pct, label = gradio_app._batch_progress(queue)
    assert pct == 100.0


def test_mix_background_music_requires_voice_file():
    audio_out, msg = gradio_app.mix_background_music(None, "music.wav", 0, -15, 2, 3, True, 8)
    assert audio_out is None
    assert "voice" in msg.lower()


def test_mix_background_music_requires_music_file():
    audio_out, msg = gradio_app.mix_background_music("voice.wav", None, 0, -15, 2, 3, True, 8)
    assert audio_out is None
    assert "music" in msg.lower()


def test_mix_background_music_success(tmp_path, monkeypatch):
    voice_file = tmp_path / "voice.wav"
    music_file = tmp_path / "music.wav"
    voice_file.write_bytes(b"fake wav data")
    music_file.write_bytes(b"fake wav data")

    class FakeResp:
        status_code = 200
        content = b"RIFF-mixed-wav-bytes"

    monkeypatch.setattr(gradio_app.requests, "post", lambda *a, **k: FakeResp())
    monkeypatch.chdir(tmp_path)

    audio_out, msg = gradio_app.mix_background_music(
        str(voice_file), str(music_file), 0, -15, 2, 3, True, 8
    )

    assert audio_out == "mixed_with_music.wav"
    assert "Done" in msg
    assert (tmp_path / "mixed_with_music.wav").read_bytes() == b"RIFF-mixed-wav-bytes"


def test_mix_background_music_reports_backend_error(tmp_path, monkeypatch):
    voice_file = tmp_path / "voice.wav"
    music_file = tmp_path / "music.wav"
    voice_file.write_bytes(b"fake")
    music_file.write_bytes(b"fake")

    class FakeErrorResp:
        status_code = 400
        text = ""

        def json(self):
            return {"detail": "Unsupported voice format"}

    monkeypatch.setattr(gradio_app.requests, "post", lambda *a, **k: FakeErrorResp())

    audio_out, msg = gradio_app.mix_background_music(
        str(voice_file), str(music_file), 0, -15, 2, 3, True, 8
    )
    assert audio_out is None
    assert "Unsupported voice format" in msg
