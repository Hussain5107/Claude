"""Tests for the pure-logic pieces of the Gradio frontend."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "frontend"))

import app as frontend_app  # noqa: E402


def test_estimate_duration_empty():
    result = frontend_app.estimate_duration("")
    assert result == "0 words -- approx 0.0 min narrated (estimate, actual pace varies)"


def test_estimate_duration_counts_words():
    text = " ".join(["word"] * frontend_app.WORDS_PER_MINUTE)
    result = frontend_app.estimate_duration(text)
    assert f"{frontend_app.WORDS_PER_MINUTE} words" in result
    assert "1.0 min" in result


def test_progress_bar_html_shows_rounded_percent_and_label():
    html = frontend_app._progress_bar_html(42.5, "chunk 5/12")
    assert "42%" in html
    assert "chunk 5/12" in html
    assert "width:42.5%" in html


def test_progress_bar_html_clamps_out_of_range_values():
    assert "width:0.0%" in frontend_app._progress_bar_html(-10, "x")
    assert "width:100.0%" in frontend_app._progress_bar_html(150, "x")


def test_fetch_voice_choices_returns_empty_on_connection_error(monkeypatch):
    import requests

    def boom(*a, **k):
        raise requests.RequestException("no backend")

    monkeypatch.setattr(frontend_app.requests, "get", boom)
    assert frontend_app.fetch_voice_choices() == []


def test_fetch_voice_choices_formats_label(monkeypatch):
    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return [{"label": "Amy", "language_label": "English (US)", "code": "en_US-amy-medium"}]

    monkeypatch.setattr(frontend_app.requests, "get", lambda *a, **k: FakeResp())
    choices = frontend_app.fetch_voice_choices()
    assert choices == [("Amy -- English (US)", "en_US-amy-medium")]
