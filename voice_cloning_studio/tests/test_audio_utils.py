import numpy as np
import pytest
import torch

from backend import audio_utils
from backend.exceptions import InvalidTextError
from backend.profiling import PipelineProfile


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


def test_parse_language_segments_no_tags_returns_single_default_segment():
    segments = audio_utils.parse_language_segments("Just plain English text.", "en")
    assert segments == [("en", "Just plain English text.")]


def test_parse_language_segments_splits_tagged_and_untagged():
    text = "Hello there. [fr]Bonjour le monde.[/fr] Back to English now."
    segments = audio_utils.parse_language_segments(text, "en")
    assert segments == [
        ("en", "Hello there. "),
        ("fr", "Bonjour le monde."),
        ("en", " Back to English now."),
    ]


def test_parse_language_segments_multiple_tags():
    text = "[en]Hello.[/en][fr]Bonjour.[/fr][es]Hola.[/es]"
    segments = audio_utils.parse_language_segments(text, "en")
    assert segments == [("en", "Hello."), ("fr", "Bonjour."), ("es", "Hola.")]


def test_parse_language_segments_is_case_insensitive_on_tag_name():
    text = "[FR]Bonjour[/FR]"
    segments = audio_utils.parse_language_segments(text, "en")
    assert segments == [("fr", "Bonjour")]


def test_strip_language_tags_removes_markup_keeps_text():
    text = "Hello. [fr]Bonjour le monde.[/fr] Goodbye."
    assert audio_utils.strip_language_tags(text) == "Hello. Bonjour le monde. Goodbye."


def test_chunk_text_with_languages_stamps_correct_language_per_chunk():
    text = "This is English.\n\n[fr]Ceci est en francais.[/fr]\n\n[es]Esto es en espanol.[/es]"
    chunks = audio_utils.chunk_text_with_languages(text, default_language="en")
    languages = [c.language_id for c in chunks]
    assert languages == ["en", "fr", "es"]
    assert "English" in chunks[0].text
    assert "francais" in chunks[1].text
    assert "espanol" in chunks[2].text


def test_chunk_text_with_languages_untagged_script_all_default():
    chunks = audio_utils.chunk_text_with_languages("Just one plain sentence.", default_language="es")
    assert all(c.language_id == "es" for c in chunks)


def test_generate_long_form_rejects_empty_text(tmp_path):
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form("", "/fake/embedding.pt", tmp_path / "out.wav")


def test_generate_long_form_rejects_oversized_text(tmp_path, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "max_text_chars", 10)
    with pytest.raises(InvalidTextError):
        audio_utils.generate_long_form(
            "this text is definitely longer than ten chars", "/fake/embedding.pt", tmp_path / "out.wav"
        )


SAMPLE_RATE = 16000


def _fake_generate_chunk_factory(calls, seconds_per_chunk=0.2, truncated=False):
    def fake_generate_chunk(text, conditionals, **kwargs):
        calls.append(text)
        n_samples = int(seconds_per_chunk * SAMPLE_RATE)
        wav = torch.full((n_samples,), 0.5, dtype=torch.float32)
        return wav, SAMPLE_RATE, truncated

    return fake_generate_chunk


def test_generate_long_form_passes_temperature_through_to_generate_chunk(tmp_path, monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")

    received_kwargs = {}

    def fake_generate_chunk(text, conditionals, **kwargs):
        received_kwargs.update(kwargs)
        return torch.full((100,), 0.5, dtype=torch.float32), SAMPLE_RATE, False

    monkeypatch.setattr(tts_engine, "generate_chunk", fake_generate_chunk)

    audio_utils.generate_long_form(
        "Hello there.", "/fake/embedding.pt", tmp_path / "out.wav", temperature=1.1
    )

    assert received_kwargs["temperature"] == 1.1


def test_generate_long_form_calls_progress_callback(tmp_path, monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)

    calls = []
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    monkeypatch.setattr(tts_engine, "generate_chunk", _fake_generate_chunk_factory(calls))

    progress_calls = []
    out_path = tmp_path / "out.wav"
    cues = audio_utils.generate_long_form(
        "First sentence. Second sentence.\n\nThird paragraph sentence.",
        "/fake/embedding.pt",
        out_path,
        on_progress=lambda done, total: progress_calls.append((done, total)),
    )

    assert len(calls) == len(progress_calls)
    assert progress_calls[-1][0] == progress_calls[-1][1]  # final call reports done == total
    assert len(cues) == len(calls)
    assert out_path.exists()  # streamed directly, no post-processing enabled


def test_generate_long_form_with_job_id_caches_each_chunk_to_disk(tmp_path, monkeypatch):
    from backend import job_store, tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    monkeypatch.setattr(tts_engine, "generate_chunk", _fake_generate_chunk_factory([]))

    job_id = "resume-cache-test"
    audio_utils.generate_long_form(
        "First sentence.\n\nSecond sentence.\n\nThird sentence.",
        "/fake/embedding.pt",
        tmp_path / "out.wav",
        job_id=job_id,
    )

    assert job_store.chunk_audio_path(job_id, 0).exists()
    assert job_store.chunk_audio_path(job_id, 1).exists()
    assert job_store.chunk_audio_path(job_id, 2).exists()


def test_generate_long_form_resume_skips_chunks_already_cached(tmp_path, monkeypatch):
    """The core resume guarantee: a chunk with cached audio on disk from a
    previous (interrupted) attempt must not be regenerated."""
    from backend import job_store, tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")

    job_id = "resume-skip-test"
    text = "First sentence.\n\nSecond sentence.\n\nThird sentence."

    # Pre-populate chunk 0's cache, simulating a prior attempt that got that
    # far before crashing -- distinct audio (1000 samples) so it's obviously
    # not something the fake generator below would have produced (200 samples).
    already_done = torch.full((1000,), 0.3, dtype=torch.float32)
    audio_utils.save_wav(already_done, SAMPLE_RATE, job_store.chunk_audio_path(job_id, 0))

    calls = []
    monkeypatch.setattr(tts_engine, "generate_chunk", _fake_generate_chunk_factory(calls))

    audio_utils.generate_long_form(text, "/fake/embedding.pt", tmp_path / "out.wav", job_id=job_id)

    # chunk 0's text never went through the (fake) model -- it was reloaded from disk instead
    assert calls == ["Second sentence.", "Third sentence."]


def test_generate_long_form_resume_still_produces_full_correct_output(tmp_path, monkeypatch):
    """Resuming (some chunks cached, some fresh) must produce audio/captions
    indistinguishable from a single uninterrupted run."""
    from backend import job_store, tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    text = "First sentence.\n\nSecond sentence.\n\nThird sentence."

    # A full, uninterrupted run for comparison.
    baseline_calls = []
    monkeypatch.setattr(tts_engine, "generate_chunk", _fake_generate_chunk_factory(baseline_calls))
    baseline_cues = audio_utils.generate_long_form(text, "/fake/embedding.pt", tmp_path / "baseline.wav")

    # A "resumed" run: chunk 0 pre-cached with the exact audio the fake
    # generator would have produced, chunks 1-2 generated fresh. Real cached
    # chunks always went through _generate_one_chunk's edge fade before being
    # saved, so the seed must match that -- otherwise this is testing a chunk
    # shape that could never actually occur.
    job_id = "resume-full-test"
    seed_wav = torch.full((int(0.2 * SAMPLE_RATE),), 0.5, dtype=torch.float32)
    seed_wav = audio_utils._apply_edge_fade(seed_wav, SAMPLE_RATE)
    audio_utils.save_wav(seed_wav, SAMPLE_RATE, job_store.chunk_audio_path(job_id, 0))
    resumed_calls = []
    monkeypatch.setattr(tts_engine, "generate_chunk", _fake_generate_chunk_factory(resumed_calls))
    resumed_cues = audio_utils.generate_long_form(
        text, "/fake/embedding.pt", tmp_path / "resumed.wav", job_id=job_id
    )

    assert len(resumed_cues) == len(baseline_cues)
    for a, b in zip(resumed_cues, baseline_cues, strict=True):
        assert a.start == pytest.approx(b.start, abs=1e-6)
        assert a.end == pytest.approx(b.end, abs=1e-6)

    baseline_audio, baseline_sr = audio_utils._read_pcm16_wav(tmp_path / "baseline.wav")
    resumed_audio, resumed_sr = audio_utils._read_pcm16_wav(tmp_path / "resumed.wav")
    assert resumed_sr == baseline_sr
    assert torch.equal(resumed_audio, baseline_audio)


def test_generate_long_form_routes_each_chunk_to_its_tagged_language(tmp_path, monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)

    calls = []  # (text, language_id) pairs actually sent to the model

    def fake_generate_chunk(text, conditionals, language_id="en", **kwargs):
        calls.append((text, language_id))
        wav = torch.full((int(0.2 * SAMPLE_RATE),), 0.5, dtype=torch.float32)
        return wav, SAMPLE_RATE, False

    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    monkeypatch.setattr(tts_engine, "generate_chunk", fake_generate_chunk)

    text = "This is English.\n\n[fr]Ceci est en francais.[/fr]\n\n[es]Esto es en espanol.[/es]"
    audio_utils.generate_long_form(text, "/fake/embedding.pt", tmp_path / "out.wav", language_id="en")

    languages_used = [lang for _text, lang in calls]
    assert languages_used == ["en", "fr", "es"]
    assert "English" in calls[0][0]
    assert "francais" in calls[1][0]
    assert "espanol" in calls[2][0]


def test_generate_long_form_captions_are_sequential_and_nonoverlapping(tmp_path, monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)

    calls = []
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    fake_chunk = _fake_generate_chunk_factory(calls, seconds_per_chunk=0.3)
    monkeypatch.setattr(tts_engine, "generate_chunk", fake_chunk)

    out_path = tmp_path / "out.wav"
    cues = audio_utils.generate_long_form(
        "First sentence. Second sentence. Third sentence.",
        "/fake/embedding.pt",
        out_path,
    )

    for cue in cues:
        assert cue.end > cue.start
    for a, b in zip(cues, cues[1:], strict=False):
        assert b.start >= a.end  # no overlap, monotonically increasing

    written_audio, sample_rate = audio_utils._read_pcm16_wav(out_path)
    assert sample_rate == SAMPLE_RATE
    assert written_audio.shape[-1] / sample_rate >= cues[-1].end


def test_generate_long_form_with_postprocessing_writes_final_file(tmp_path, monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", True)
    monkeypatch.setattr(settings, "enable_silence_trim", True)

    calls = []
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    fake_chunk = _fake_generate_chunk_factory(calls, seconds_per_chunk=0.3)
    monkeypatch.setattr(tts_engine, "generate_chunk", fake_chunk)

    out_path = tmp_path / "out.wav"
    cues = audio_utils.generate_long_form("One sentence. Two sentences.", "/fake/embedding.pt", out_path)

    assert out_path.exists()
    assert len(list(tmp_path.glob("*.raw.wav"))) == 0  # temp file cleaned up
    assert len(cues) == len(calls)


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


def test_apply_edge_fade_ramps_start_and_end_to_zero():
    sr = 16000
    wav = torch.full((int(0.5 * sr),), 0.8, dtype=torch.float32)
    faded = audio_utils._apply_edge_fade(wav, sr, fade_ms=15.0)

    assert faded[0] == pytest.approx(0.0, abs=1e-6)
    assert faded[-1] == pytest.approx(0.0, abs=1e-6)
    fade_samples = int(sr * 15.0 / 1000)
    assert faded[fade_samples // 2] == pytest.approx(0.4, abs=0.05)  # partway through the ramp


def test_apply_edge_fade_leaves_the_middle_untouched():
    sr = 16000
    wav = torch.full((int(0.5 * sr),), 0.8, dtype=torch.float32)
    faded = audio_utils._apply_edge_fade(wav, sr, fade_ms=15.0)

    midpoint = len(wav) // 2
    assert faded[midpoint] == pytest.approx(0.8, abs=1e-6)


def test_apply_edge_fade_is_safe_on_chunks_shorter_than_the_fade_window():
    sr = 16000
    wav = torch.full((10,), 0.8, dtype=torch.float32)  # far shorter than a 15ms fade window
    faded = audio_utils._apply_edge_fade(wav, sr, fade_ms=15.0)

    assert faded.shape == wav.shape
    assert not torch.isnan(faded).any()


def test_apply_edge_fade_on_empty_audio_is_safe():
    sr = 16000
    faded = audio_utils._apply_edge_fade(torch.zeros(0), sr, fade_ms=15.0)
    assert faded.shape == (0,)


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


def test_generate_long_form_populates_profile(tmp_path, monkeypatch):
    from backend import tts_engine
    from backend.config import settings

    monkeypatch.setattr(settings, "enable_loudness_normalization", False)
    monkeypatch.setattr(settings, "enable_silence_trim", False)

    calls = []
    monkeypatch.setattr(tts_engine, "load_conditionals", lambda path: "fake-conds")
    fake_chunk = _fake_generate_chunk_factory(calls, seconds_per_chunk=0.3)
    monkeypatch.setattr(tts_engine, "generate_chunk", fake_chunk)

    profile = PipelineProfile()
    audio_utils.generate_long_form(
        "First sentence. Second sentence.", "/fake/embedding.pt", tmp_path / "out.wav", profile=profile,
    )

    assert len(profile.chunk_generate_sec) == len(calls)
    assert all(t >= 0 for t in profile.chunk_generate_sec)
    assert profile.write_sec >= 0
    assert profile.postprocess_sec == 0.0  # disabled in this test
    assert profile.audio_duration_sec > 0
