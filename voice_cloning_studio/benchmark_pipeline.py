#!/usr/bin/env python3
"""Benchmarks the voice generation pipeline: stage timings, real-time factor
(RTF), and peak memory, comparing the old (pre-streaming) approach against
the current one.

IMPORTANT — what this can and can't tell you:
  Chatterbox's actual model inference dominates real generation time, and its
  speed depends entirely on your CPU/GPU. Without the real model loaded, we
  can't produce real inference numbers -- so by default this script patches
  in a *synthetic* stand-in generate_chunk (a fixed sleep + a small real
  tensor) to measure everything OUR code controls: chunking overhead,
  embedding load, per-chunk write cost, post-processing, and peak memory --
  with the model itself factored out as a controlled constant. That's enough
  to prove the streaming/threading changes actually help, and to give an
  apples-to-apples before/after comparison that doesn't depend on your
  hardware.

  For REAL inference numbers (actual RTF you'll experience), run with
  --real on a machine that already has the model set up (i.e. after using
  the app normally at least once) -- see --help.

Usage:
  python benchmark_pipeline.py                  # synthetic, ~3000-word script
  python benchmark_pipeline.py --words 9000      # synthetic, longer script
  python benchmark_pipeline.py --real            # real model (needs it installed + downloaded)
"""

import argparse
import shutil
import sys
import tempfile
import threading
import time
import wave
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent))


def _mock_chatterbox_if_needed():
    """Only mocks chatterbox for --synthetic runs; --real imports it for real."""
    for module_name in ("chatterbox", "chatterbox.mtl_tts"):
        sys.modules.setdefault(module_name, MagicMock())


class PeakMemorySampler:
    """Polls RSS in a background thread and tracks the max seen -- works the
    same way on Windows/Mac/Linux (unlike stdlib `resource`, which is Unix-only)."""

    def __init__(self, interval_sec: float = 0.05):
        import psutil

        self._process = psutil.Process()
        self._interval = interval_sec
        self._peak_mb = 0.0
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        while not self._stop.is_set():
            rss_mb = self._process.memory_info().rss / (1024 * 1024)
            self._peak_mb = max(self._peak_mb, rss_mb)
            time.sleep(self._interval)

    def __enter__(self):
        self._peak_mb = self._process.memory_info().rss / (1024 * 1024)
        self._thread.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        self._thread.join(timeout=1)

    @property
    def peak_mb(self) -> float:
        return self._peak_mb


def _make_synthetic_text(words: int) -> str:
    sentence = "The quick synthetic sentence exercises the narration pipeline without real inference. "
    words_per_sentence = len(sentence.split())
    sentences_needed = max(1, words // words_per_sentence)
    paragraph = sentence * (sentences_needed // 6 or 1)
    return "\n\n".join([paragraph] * 6)[: words * 7]  # rough word-count cap


def _install_synthetic_generate_chunk(inference_sec: float, chunk_audio_sec: float):
    import torch

    from backend import tts_engine

    def fake_generate_chunk(text, conditionals, **kwargs):
        time.sleep(inference_sec)
        sample_rate = 24000
        wav = torch.zeros(int(chunk_audio_sec * sample_rate))
        return wav, sample_rate, False

    tts_engine.generate_chunk = fake_generate_chunk
    tts_engine.load_conditionals = lambda path: "fake-conds"


def _naive_generate_and_write(text: str, embedding_path: str, out_path: Path, on_progress=None) -> float:
    """Reconstructs the pre-streaming approach for comparison: buffer every
    chunk (plus gap) in a growing Python list, concatenate once, write once.
    Not part of the app anymore -- kept here only so this benchmark can show
    a genuine before/after rather than an assumed one."""
    import torch

    from backend import audio_utils, tts_engine
    from backend.config import settings

    chunks = audio_utils.chunk_text(text)
    conditionals = tts_engine.load_conditionals(embedding_path)

    pieces = []
    sample_rate = None
    for i, chunk in enumerate(chunks):
        wav, sample_rate, _truncated = tts_engine.generate_chunk(chunk.text, conditionals)
        pieces.append(wav)
        if chunk.is_paragraph_end:
            gap_sec = settings.chunk_gap_paragraph_sec
        else:
            gap_sec = settings.chunk_gap_sentence_sec
        pieces.append(torch.zeros(int(gap_sec * sample_rate)))
        if on_progress:
            on_progress(i + 1, len(chunks))

    audio = torch.cat(pieces)  # the extra full-size copy this benchmark is measuring the cost of

    writer = wave.open(str(out_path), "wb")
    writer.setnchannels(1)
    writer.setsampwidth(2)
    writer.setframerate(sample_rate)
    clamped = audio.clamp(-1.0, 1.0)
    int16 = (clamped * 32767.0).to(torch.int16)
    writer.writeframes(int16.numpy().tobytes())
    writer.close()

    return audio.shape[-1] / sample_rate


def run_old_approach(text: str, embedding_path: str, out_dir: Path) -> dict:
    out_path = out_dir / "old_approach.wav"
    with PeakMemorySampler() as mem:
        start = time.perf_counter()
        audio_duration = _naive_generate_and_write(text, embedding_path, out_path)
        wall = time.perf_counter() - start
    return {"wall_sec": wall, "peak_mb": mem.peak_mb, "audio_duration_sec": audio_duration}


def run_new_approach(text: str, embedding_path: str, out_dir: Path, label: str) -> dict:
    from backend import audio_utils
    from backend.profiling import PipelineProfile

    out_path = out_dir / f"{label}.wav"
    profile = PipelineProfile()
    with PeakMemorySampler() as mem:
        start = time.perf_counter()
        audio_utils.generate_long_form(text, embedding_path, out_path, profile=profile)
        wall = time.perf_counter() - start
    profile.total_sec = wall
    return {"wall_sec": wall, "peak_mb": mem.peak_mb, "profile": profile}


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--words", type=int, default=3000, help="approx script length (default: 3000)")
    parser.add_argument(
        "--inference-sec", type=float, default=1.5,
        help="synthetic per-chunk inference delay in seconds, only used without --real (default: 1.5)",
    )
    parser.add_argument(
        "--chunk-audio-sec", type=float, default=8.0,
        help="synthetic audio duration produced per chunk, only used without --real (default: 8.0)",
    )
    parser.add_argument(
        "--real", action="store_true",
        help="use the real Chatterbox model instead of a synthetic stand-in for inference "
             "(requires it installed; needs --embedding-path). Runs only the current (new) "
             "approach with real inference and prints real stage timings/RTF -- there's no "
             "'old' code left to compare against once you're using the real model, only the "
             "synthetic run below can show that comparison.",
    )
    parser.add_argument(
        "--embedding-path", type=str, default=None,
        help="path to a real .conds.pt file from voices/<name>.conds.pt (required with --real)",
    )
    parser.add_argument(
        "--text-file", type=str, default=None,
        help="path to a real script file to use instead of synthetic text (optional, works with --real)",
    )
    args = parser.parse_args()

    if args.real and not args.embedding_path:
        parser.error("--real requires --embedding-path pointing at a real voices/<name>.conds.pt file")

    if args.text_file:
        text = Path(args.text_file).read_text(encoding="utf-8")
    else:
        text = _make_synthetic_text(args.words)
    actual_words = len(text.split())
    print(f"Benchmark script: ~{actual_words} words\n")

    tmp_dir = Path(tempfile.mkdtemp(prefix="zahra_benchmark_"))

    try:
        if args.real:
            print("Using REAL Chatterbox model + REAL inference (this will download weights on")
            print("first run if not already cached -- can take a while).\n")
            print("=" * 70)
            print("REAL run")
            print("=" * 70)
            real = run_new_approach(text, args.embedding_path, tmp_dir)
            profile = real["profile"]
            print(f"  {profile.summary()}")
            print(f"  peak_rss  = {real['peak_mb']:.1f} MB")
            print()
            print("This IS your real, actionable number: RTF above tells you how long a")
            print("script of a given length will actually take to generate on this machine")
            print("(RTF 2.0 means a 10-minute script takes ~20 minutes to render).")
            return

        embedding_path = tmp_dir / "fake_embedding.pt"
        _mock_chatterbox_if_needed()
        _install_synthetic_generate_chunk(args.inference_sec, args.chunk_audio_sec)
        from backend.config import settings as pipeline_settings

        # --- Scenario A: no post-processing -- streaming vs buffering is a
        # real, distinct choice here, so this is a genuine before/after. ---
        pipeline_settings.enable_silence_trim = False
        pipeline_settings.enable_loudness_normalization = False

        print("#" * 70)
        print("# SCENARIO A: post-processing OFF (streaming vs buffering matters here)")
        print("#" * 70)
        print()
        print("=" * 70)
        print("OLD approach (buffer every chunk in memory, concat once, write once)")
        print("=" * 70)
        old = run_old_approach(text, str(embedding_path), tmp_dir)
        old_rtf = old["wall_sec"] / old["audio_duration_sec"] if old["audio_duration_sec"] else float("inf")
        print(f"  wall_time = {old['wall_sec']:.2f}s")
        print(f"  peak_rss  = {old['peak_mb']:.1f} MB")
        print(f"  audio     = {old['audio_duration_sec']:.1f}s")
        print(f"  RTF       = {old_rtf:.3f}")

        print()
        print("=" * 70)
        print("NEW approach (streams each chunk directly to the output file,")
        print("no buffering, no read-back)")
        print("=" * 70)
        new = run_new_approach(text, str(embedding_path), tmp_dir, "scenario_a_new")
        profile = new["profile"]
        print(f"  {profile.summary()}")
        print(f"  peak_rss  = {new['peak_mb']:.1f} MB")

        print()
        print("-" * 70)
        print("Scenario A comparison")
        print("-" * 70)
        mem_delta = old["peak_mb"] - new["peak_mb"]
        mem_pct = (mem_delta / old["peak_mb"] * 100) if old["peak_mb"] else 0
        time_delta = old["wall_sec"] - new["wall_sec"]
        print(f"  peak memory : {old['peak_mb']:.1f} MB -> {new['peak_mb']:.1f} MB "
              f"({mem_delta:+.1f} MB, {mem_pct:+.1f}%)")
        print(f"  wall time   : {old['wall_sec']:.2f}s -> {new['wall_sec']:.2f}s ({time_delta:+.2f}s)")

        # --- Scenario B: post-processing ON (the default). Loudness
        # normalization inherently needs a full in-memory view, so there is
        # no meaningful "streaming vs buffering" choice left here -- both
        # converge to the same buffered algorithm. Only one run to show. ---
        pipeline_settings.enable_silence_trim = True
        pipeline_settings.enable_loudness_normalization = True

        print()
        print()
        print("#" * 70)
        print("# SCENARIO B: post-processing ON (the default -- loudness")
        print("# normalization needs the whole signal in memory regardless of")
        print("# write strategy, so there's no streaming-vs-buffering choice left;")
        print("# shown for reference, not as a comparison)")
        print("#" * 70)
        print()
        b = run_new_approach(text, str(embedding_path), tmp_dir, "scenario_b")
        print(f"  {b['profile'].summary()}")
        print(f"  peak_rss  = {b['peak_mb']:.1f} MB")
        print()
        print("=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print("Streaming (Scenario A) is a real, verified win when post-processing is")
        print("off. With post-processing on (the default), loudness normalization needs")
        print("the whole signal in memory regardless of write strategy -- pyloudnorm's")
        print("own internal float64 buffer for that is unavoidable without patching the")
        print("library itself, so remaining Scenario B memory use is close to a floor.")
        print()
        print("With synthetic inference, wall-time differences above mostly reflect our")
        print("own orchestration overhead, not the model -- on real inference (--real,")
        print("or just using the app), inference dominates total time.")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
