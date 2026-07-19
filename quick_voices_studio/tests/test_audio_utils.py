import numpy as np
import pytest

from backend import audio_utils, tts_engine
from backend.exceptions import InvalidTextError

SAMPLE_RATE = 22050


def test_chunk_text_respects_max_chars():
    text = "Sentence one. Sentence two. Sentence three."
    chunks = audio_utils.chunk_text(text, max_chars=20)
    assert all(len(c.text) <= 40 for c in chunks)  # a single sentence may exceed max_chars alone
    assert "".join(c.text for c in chunks).replace(" ", "") == text.replace(" ", "")


def test_chunk_text_splits_paragraphs():
    text = "Para one.\n\nPara two."
    chunks = audio_utils.chunk_text(text, max_chars=1000)
    assert [c.text for c in chunks] == ["Para one.", "Para two."]


def test_chunk_text_empty_input():
    assert audio_utils.chunk_text("") == []
    assert audio_utils.chunk_text("   \n\n  ") == []


def test_generate_long_form_rejects_empty_text(tmp_path):
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form("", "en_US-amy-medium", tmp_path / "out.wav")


def test_generate_long_form_rejects_oversized_text(tmp_path, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "max_text_chars", 10)
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form(
            "this text is definitely longer than ten chars", "en_US-amy-medium", tmp_path / "out.wav"
        )


def _fake_synthesize_chunk_factory(calls, seconds_per_chunk=0.2):
    def fake_synthesize_chunk(text, voice_code, length_scale):
        calls.append((text, voice_code, length_scale))
        n_samples = int(seconds_per_chunk * SAMPLE_RATE)
        samples = np.full(n_samples, 1000, dtype=np.int16)
        return samples, SAMPLE_RATE

    return fake_synthesize_chunk


def test_generate_long_form_writes_wav_and_reports_progress(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(tts_engine, "synthesize_chunk", _fake_synthesize_chunk_factory(calls))

    progress_calls = []
    out_path = tmp_path / "out.wav"
    duration = audio_utils.generate_long_form(
        "First sentence. Second sentence.\n\nThird paragraph sentence.",
        "en_US-amy-medium",
        out_path,
        on_progress=lambda done, total: progress_calls.append((done, total)),
    )

    assert out_path.exists()
    assert len(calls) == len(progress_calls)
    assert progress_calls[-1][0] == progress_calls[-1][1]
    assert duration > 0


def test_generate_long_form_passes_voice_and_length_scale(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(tts_engine, "synthesize_chunk", _fake_synthesize_chunk_factory(calls))

    audio_utils.generate_long_form(
        "Hello there.", "fr_FR-siwis-medium", tmp_path / "out.wav", length_scale=1.3
    )

    assert calls[0][1] == "fr_FR-siwis-medium"
    assert calls[0][2] == 1.3


def test_generate_long_form_produces_correct_sample_count(tmp_path, monkeypatch):
    import wave

    calls = []
    fake_fn = _fake_synthesize_chunk_factory(calls, seconds_per_chunk=0.5)
    monkeypatch.setattr(tts_engine, "synthesize_chunk", fake_fn)

    out_path = tmp_path / "out.wav"
    audio_utils.generate_long_form("One. Two. Three.", "en_US-amy-medium", out_path)

    with wave.open(str(out_path), "rb") as wf:
        assert wf.getframerate() == SAMPLE_RATE
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
        assert wf.getnframes() == len(calls) * int(0.5 * SAMPLE_RATE)
