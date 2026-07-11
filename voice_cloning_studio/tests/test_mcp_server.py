"""Tests for the MCP bridge's own logic (voice lookup, status shaping, error
handling) using mocked HTTP responses -- no live backend or MCP client needed.
The manual end-to-end flow (real backend + real tool calls) was verified
separately; this covers regressions in the bridge's own code."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mcp_server"))

import zahra_mcp  # noqa: E402


def _fake_response(json_data=None, status_code=200, text=""):
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    resp.json.return_value = json_data
    if status_code >= 400:
        resp.raise_for_status.side_effect = Exception(f"HTTP {status_code}")
    else:
        resp.raise_for_status.return_value = None
    return resp


def test_find_voice_matches_by_name(monkeypatch):
    voices = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
    monkeypatch.setattr(zahra_mcp.requests, "get", lambda *a, **k: _fake_response(voices))
    assert zahra_mcp._find_voice("bob")["id"] == 2  # case-insensitive


def test_find_voice_matches_by_id(monkeypatch):
    voices = [{"id": 1, "name": "Alice"}]
    monkeypatch.setattr(zahra_mcp.requests, "get", lambda *a, **k: _fake_response(voices))
    assert zahra_mcp._find_voice("1")["name"] == "Alice"


def test_find_voice_returns_none_when_missing(monkeypatch):
    monkeypatch.setattr(zahra_mcp.requests, "get", lambda *a, **k: _fake_response([]))
    assert zahra_mcp._find_voice("nobody") is None


def test_submit_narration_raises_for_unknown_voice(monkeypatch):
    monkeypatch.setattr(zahra_mcp, "_find_voice", lambda name: None)
    with pytest.raises(ValueError, match="No saved voice"):
        zahra_mcp.submit_narration("hello", "nobody")


def test_submit_narration_success(monkeypatch):
    monkeypatch.setattr(zahra_mcp, "_find_voice", lambda name: {"id": 5, "name": "Alice"})
    monkeypatch.setattr(
        zahra_mcp.requests, "post",
        lambda *a, **k: _fake_response({"job_id": "abc123"}, status_code=202),
    )
    result = zahra_mcp.submit_narration("one two three four five", "Alice")
    assert result == {"job_id": "abc123", "voice": "Alice", "estimated_minutes": round(5 / 140, 1)}


def test_submit_narration_raises_on_backend_error(monkeypatch):
    monkeypatch.setattr(zahra_mcp, "_find_voice", lambda name: {"id": 5, "name": "Alice"})
    monkeypatch.setattr(
        zahra_mcp.requests, "post",
        lambda *a, **k: _fake_response({"detail": "boom"}, status_code=400),
    )
    with pytest.raises(RuntimeError, match="boom"):
        zahra_mcp.submit_narration("hi", "Alice")


def test_check_narration_status_computes_percent(monkeypatch):
    job = {"status": "running", "chunks_done": 3, "chunks_total": 12, "error": None}
    monkeypatch.setattr(zahra_mcp.requests, "get", lambda *a, **k: _fake_response(job))
    result = zahra_mcp.check_narration_status("job1")
    assert result["percent"] == 25


def test_get_narration_result_raises_if_not_done(monkeypatch):
    monkeypatch.setattr(zahra_mcp, "check_narration_status", lambda job_id: {"status": "running"})
    with pytest.raises(RuntimeError, match="not finished"):
        zahra_mcp.get_narration_result("job1")


def test_wait_for_narration_returns_on_completion(monkeypatch):
    monkeypatch.setattr(zahra_mcp, "check_narration_status", lambda job_id: {"status": "done"})
    result = zahra_mcp.wait_for_narration("job1", timeout_seconds=5)
    assert result["status"] == "done"


def test_wait_for_narration_times_out(monkeypatch):
    monkeypatch.setattr(zahra_mcp, "check_narration_status", lambda job_id: {"status": "running"})
    monkeypatch.setattr(zahra_mcp.time, "sleep", lambda s: None)
    result = zahra_mcp.wait_for_narration("job1", timeout_seconds=0)
    assert result["status"] == "timeout"
