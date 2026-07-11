"""Lightweight stage timing for the generation pipeline.

Wall-clock timing only, cheap enough to leave on by default -- no external
profiler dependency. Real inference timing depends entirely on the actual
model and hardware it runs on, which varies per machine; this module
measures whatever pipeline actually runs, wherever it runs, rather than
assuming numbers that only hold on one specific setup.
"""

import time
from contextlib import contextmanager
from dataclasses import dataclass, field

from .logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class PipelineProfile:
    model_load_sec: float = 0.0
    embedding_load_sec: float = 0.0
    chunk_generate_sec: list[float] = field(default_factory=list)
    postprocess_sec: float = 0.0
    write_sec: float = 0.0
    total_sec: float = 0.0
    audio_duration_sec: float = 0.0
    peak_memory_mb: float | None = None

    @property
    def inference_sec(self) -> float:
        return sum(self.chunk_generate_sec)

    @property
    def real_time_factor(self) -> float:
        """Wall-clock seconds spent per second of output audio.

        < 1.0 means generation is faster than real-time playback (e.g. 0.5
        means a 10-minute script takes 5 minutes to render); > 1.0 means
        it's slower than real-time.
        """
        return self.total_sec / self.audio_duration_sec if self.audio_duration_sec else float("inf")

    def summary(self) -> str:
        n = len(self.chunk_generate_sec)
        avg_chunk = self.inference_sec / n if n else 0.0
        mem = f" peak_mem={self.peak_memory_mb:.1f}MB" if self.peak_memory_mb is not None else ""
        return (
            f"model_load={self.model_load_sec:.2f}s "
            f"embedding_load={self.embedding_load_sec:.3f}s "
            f"inference={self.inference_sec:.2f}s ({n} chunks, avg {avg_chunk:.3f}s/chunk) "
            f"postprocess={self.postprocess_sec:.3f}s "
            f"write={self.write_sec:.3f}s "
            f"total={self.total_sec:.2f}s "
            f"audio={self.audio_duration_sec:.2f}s "
            f"RTF={self.real_time_factor:.3f}"
            f"{mem}"
        )


@contextmanager
def stage_timer():
    """Usage: with stage_timer() as t: ... ; elapsed = t['elapsed']"""
    holder = {"elapsed": 0.0}
    start = time.perf_counter()
    try:
        yield holder
    finally:
        holder["elapsed"] = time.perf_counter() - start
