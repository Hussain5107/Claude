"""Real numeric checks for mixer.py -- runs actual soundfile/pedalboard/numpy
signal math (nothing here is mocked), same philosophy as the rest of the
audio-processing tests: mixing correctness can't be verified by a mock.
"""

import numpy as np
import pytest
import soundfile as sf

from backend import mixer
from backend.exceptions import InvalidAudioError

SR = 22050


def _write_wav(path, samples, sr=SR):
    sf.write(str(path), samples, sr)
    return path


def _sine(freq, seconds, sr=SR, amp=0.5):
    t = np.arange(int(sr * seconds)) / sr
    return (np.sin(2 * np.pi * freq * t) * amp).astype(np.float32)


def _bursty_voice(sr=SR):
    """0-2s active, 2-3s silent, 3-5s active, 5-6s silent, 6-8s active, 6-10s silent."""
    voice = np.zeros(sr * 10, dtype=np.float32)
    for start in (0, 3, 6):
        seg = _sine(200, 2.0, sr)
        voice[start * sr:start * sr + len(seg)] = seg
    return voice


def test_load_audio_file_downmixes_stereo_to_mono(tmp_path):
    stereo = np.stack([_sine(440, 1.0), _sine(220, 1.0)], axis=1)
    path = _write_wav(tmp_path / "stereo.wav", stereo)
    samples, sr = mixer.load_audio_file(path)
    assert samples.ndim == 1
    assert sr == SR


def test_load_audio_file_raises_domain_error_on_bad_file(tmp_path):
    bad = tmp_path / "not_audio.wav"
    bad.write_bytes(b"this is not a real wav file")
    with pytest.raises(InvalidAudioError):
        mixer.load_audio_file(bad)


def test_apply_gain_zero_is_a_noop():
    audio = _sine(440, 1.0)
    assert np.array_equal(mixer.apply_gain(audio, 0.0), audio)


def test_apply_gain_matches_db_math():
    audio = _sine(440, 1.0)
    gained = mixer.apply_gain(audio, -6.0)
    ratio = np.abs(gained).max() / np.abs(audio).max()
    assert ratio == pytest.approx(10 ** (-6 / 20), rel=1e-4)


def test_loop_or_trim_trims_longer_music():
    music = _sine(440, 5.0)
    target = SR * 2
    result = mixer.loop_or_trim_to_length(music, target, SR, loop=True)
    assert len(result) == target


def test_loop_or_trim_loops_shorter_music_to_exact_length():
    music = _sine(440, 2.0)
    target = SR * 7
    result = mixer.loop_or_trim_to_length(music, target, SR, loop=True)
    assert len(result) == target


def test_loop_or_trim_no_amplitude_spike_at_loop_seam():
    music = _sine(440, 2.0, amp=0.8)
    target = SR * 6
    result = mixer.loop_or_trim_to_length(music, target, SR, loop=True)
    seam = SR * 2
    window = result[seam - 200:seam + 200]
    assert np.abs(window).max() <= 0.85  # not blown up past the source amplitude


def test_loop_or_trim_without_loop_pads_with_silence():
    music = _sine(440, 2.0)
    target = SR * 5
    result = mixer.loop_or_trim_to_length(music, target, SR, loop=False)
    assert len(result) == target
    assert np.all(result[SR * 2:] == 0.0)


def test_apply_fade_ramps_edges_to_zero_and_leaves_middle_alone():
    music = _sine(440, 4.0, amp=0.8)
    faded = mixer.apply_fade(music.copy(), SR, fade_in_sec=1.0, fade_out_sec=1.0)

    assert faded[0] == pytest.approx(0.0, abs=1e-6)
    assert faded[-1] == pytest.approx(0.0, abs=1e-6)

    mid_faded_rms = np.sqrt(np.mean(faded[int(1.5 * SR):int(2.5 * SR)] ** 2))
    mid_orig_rms = np.sqrt(np.mean(music[int(1.5 * SR):int(2.5 * SR)] ** 2))
    assert mid_faded_rms == pytest.approx(mid_orig_rms, rel=1e-4)


def test_voice_activity_envelope_distinguishes_speech_from_pauses():
    voice = _bursty_voice()
    env = mixer.compute_voice_activity_envelope(voice, SR)

    for t_active in (1.0, 4.0, 7.0):
        assert env[int(t_active * SR)] > 0.8
    for t_silent in (2.7, 5.7, 8.7):
        assert env[int(t_silent * SR)] < 0.1


def test_duck_music_zero_db_is_a_noop():
    music = _sine(440, 10.0)
    voice = _bursty_voice()
    assert np.array_equal(mixer.duck_music(music, voice, SR, 0.0), music)


def test_duck_music_lowers_level_under_active_voice():
    music = _sine(440, 10.0, amp=0.8)
    voice = _bursty_voice()
    ducked = mixer.duck_music(music.copy(), voice, SR, duck_db=12.0)

    active_rms = np.sqrt(np.mean(ducked[int(1.0 * SR):int(1.0 * SR) + 2000] ** 2))
    silent_rms = np.sqrt(np.mean(ducked[int(2.7 * SR):int(2.7 * SR) + 2000] ** 2))
    expected_ratio = 10 ** (-12 / 20)
    assert (active_rms / silent_rms) == pytest.approx(expected_ratio, rel=0.05)


def test_mix_audio_produces_correct_duration_and_no_clipping(tmp_path):
    voice = _bursty_voice()
    music = _sine(440, 4.0, amp=0.8)
    voice_path = _write_wav(tmp_path / "voice.wav", voice)
    music_path = _write_wav(tmp_path / "music.wav", music)
    out_path = tmp_path / "mixed.wav"

    duration = mixer.mix_audio(
        voice_path, music_path, out_path,
        voice_gain_db=0, music_gain_db=-10, duck_db=8, loop_music=True,
    )

    mixed, sr = sf.read(str(out_path))
    assert duration == pytest.approx(len(voice) / SR, abs=0.01)
    assert len(mixed) == pytest.approx(len(voice), abs=sr * 0.01)
    assert np.abs(mixed).max() <= 1.0 + 1e-6


def test_mix_audio_resamples_mismatched_music_sample_rate(tmp_path):
    voice = _sine(200, 3.0, sr=SR)
    music = _sine(440, 3.0, sr=44100)  # different sample rate than the voice track
    voice_path = _write_wav(tmp_path / "voice.wav", voice, sr=SR)
    music_path = _write_wav(tmp_path / "music.wav", music, sr=44100)
    out_path = tmp_path / "mixed.wav"

    mixer.mix_audio(voice_path, music_path, out_path)

    mixed, sr = sf.read(str(out_path))
    assert sr == SR  # output follows the voice track's sample rate
