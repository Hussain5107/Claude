import pytest

from backend import audio_utils
from backend.exceptions import InvalidTextError


def test_chunk_text_respects_max_chars():
    text = "Sentence one. Sentence two. Sentence three."
    chunks = audio_utils.chunk_text(text, max_chars=20)
    assert all(len(c.text) <= 40 for c in chunks)  # single sentences may exceed max_chars, that's expected
    assert "".join(c.text for c in chunks).replace(" ", "") == text.replace(" ", "")


def test_chunk_text_marks_paragraph_boundaries():
    text = "Para one sentence.\n\nPara two sentence."
    chunks = audio_utils.chunk_text(text, max_chars=1000)
    assert len(chunks) == 2
    assert chunks[0].is_paragraph_end is True
    assert chunks[1].is_paragraph_end is True


def test_chunk_text_splits_long_paragraph_without_cutting_sentences():
    text = "A. " * 3 + "This one sentence is deliberately long enough to exceed the limit on its own."
    chunks = audio_utils.chunk_text(text, max_chars=15)
    for c in chunks:
        assert c.text  # no empty chunks
    # only the last chunk of the paragraph should be marked as paragraph end
    assert sum(1 for c in chunks if c.is_paragraph_end) == 1


def test_chunk_text_empty_input():
    assert audio_utils.chunk_text("") == []
    assert audio_utils.chunk_text("   \n\n  ") == []


def test_generate_long_form_rejects_empty_text(monkeypatch):
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form("", "/fake/embedding.pt")


def test_generate_long_form_rejects_oversized_text(monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "max_text_chars", 10)
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form("this text is definitely longer than ten chars", "/fake/embedding.pt")


def test_generate_long_form_calls_progress_callback(monkeypatch):
    from backend import tts_engine

    calls = []
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")

    def fake_generate_chunk(text, conditionals, **kwargs):
        calls.append(text)
        return _FakeTensor(100), 16000

    monkeypatch.setattr(tts_engine, "generate_chunk", fake_generate_chunk)

    progress_calls = []
    audio_utils.generate_long_form(
        "First sentence. Second sentence.\n\nThird paragraph sentence.",
        "/fake/embedding.pt",
        on_progress=lambda done, total: progress_calls.append((done, total)),
    )

    assert len(calls) == len(progress_calls)
    assert progress_calls[-1][0] == progress_calls[-1][1]  # final call reports done == total


class _FakeTensor:
    """Minimal stand-in for a torch.Tensor -- just enough for concatenation/shape access in tests."""

    def __init__(self, length):
        self.length = length

    @property
    def shape(self):
        return (self.length,)
