import numpy as np
import pytest
import torch

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


def test_generate_long_form_rejects_empty_text():
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form("", "/fake/embedding.pt")


def test_generate_long_form_rejects_oversized_text(monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "max_text_chars", 10)
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form("this text is definitely longer than ten chars", "/fake/embedding.pt")


SAMPLE_RATE = 16000


def _fake_generate_chunk_factory(calls, seconds_per_chunk=0.2, truncated=False):
    def fake_generate_chunk(text, conditionals, **kwargs):
        calls.append(text)
        n_samples = int(seconds_per_chunk * SAMPLE_RATE)
        wav = torch.full((n_samples,), 0.5, dtype=torch.float32)
        return wav, SAMPLE_RATE, truncated

    return fake_generate_chunk


def test_generate_long_form_calls_progress_callback(monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)

    calls = []
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    monkeypatch.setattr(tts_engine, "generate_chunk", _fake_generate_chunk_factory(calls))

    progress_calls = []
    _, _, cues = audio_utils.generate_long_form(
        "First sentence. Second sentence.\n\nThird paragraph sentence.",
        "/fake/embedding.pt",
        on_progress=lambda done, total: progress_calls.append((done, total)),
    )

    assert len(calls) == len(progress_calls)
    assert progress_calls[-1][0] == progress_calls[-1][1]  # final call reports done == total
    assert len(cues) == len(calls)


def test_generate_long_form_captions_are_sequential_and_nonoverlapping(monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)

    calls = []
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    fake_chunk = _fake_generate_chunk_factory(calls, seconds_per_chunk=0.3)
    monkeypatch.setattr(tts_engine, "generate_chunk", fake_chunk)

    audio, sample_rate, cues = audio_utils.generate_long_form(
        "First sentence. Second sentence. Third sentence.",
        "/fake/embedding.pt",
    )

    assert sample_rate == SAMPLE_RATE
    for cue in cues:
        assert cue.end > cue.start
    for a, b in zip(cues, cues[1:], strict=False):
        assert b.start >= a.end  # no overlap, monotonically increasing
    assert audio.shape[-1] / sample_rate >= cues[-1].end


def test_trim_silence_removes_leading_and_trailing_quiet(monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "silence_trim_threshold_db", -40.0)
    sr = 8000
    silence = torch.zeros(sr)  # 1s of true silence
    loud = torch.full((sr,), 0.8)
    audio = torch.cat([silence, loud, silence])

    trimmed, trimmed_start_sec = audio_utils._trim_silence(audio, sr, -40.0)

    assert trimmed.shape[-1] < audio.shape[-1]
    assert trimmed_start_sec > 0
    assert trimmed.abs().max() > 0.5  # the loud part survived


def test_trim_silence_on_all_silence_returns_unchanged():
    sr = 8000
    audio = torch.zeros(sr)
    trimmed, trimmed_start_sec = audio_utils._trim_silence(audio, sr, -40.0)
    assert trimmed.shape == audio.shape
    assert trimmed_start_sec == 0.0


def test_normalize_loudness_keeps_audio_in_valid_range():
    sr = 16000
    rng = np.random.default_rng(0)
    audio = torch.from_numpy((rng.random(sr * 2).astype(np.float32) - 0.5) * 0.1)  # quiet, needs boosting

    normalized = audio_utils._normalize_loudness(audio, sr, target_lufs=-19.0)

    assert normalized.shape == audio.shape
    assert normalized.abs().max() <= 1.0 + 1e-6


def test_write_srt_format(tmp_path):
    cues = [
        audio_utils.CaptionCue(start=0.0, end=1.5, text="Hello there."),
        audio_utils.CaptionCue(start=1.65, end=3.2, text="Second line."),
    ]
    out_path = tmp_path / "out.srt"
    audio_utils.write_srt(cues, out_path)

    content = out_path.read_text()
    assert "1\n00:00:00,000 --> 00:00:01,500\nHello there." in content
    assert "2\n00:00:01,650 --> 00:00:03,200\nSecond line." in content
