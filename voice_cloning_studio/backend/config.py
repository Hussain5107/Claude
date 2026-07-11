"""Centralized, environment-driven configuration.

Every tunable lives here so behavior can be changed without editing code.
Reads from process environment variables (and a local .env file if
python-dotenv is available), all with sensible defaults.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _env_str(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except ValueError:
        return default


def _env_bool(key: str, default: bool) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    # Paths
    voices_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "voices")
    output_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "output")
    db_path: Path = field(default_factory=lambda: PROJECT_ROOT / "voices.db")

    # Server
    log_level: str = field(default_factory=lambda: _env_str("LOG_LEVEL", "INFO"))

    # Upload validation
    allowed_audio_extensions: tuple = (".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac")
    max_upload_mb: int = field(default_factory=lambda: _env_int("MAX_UPLOAD_MB", 50))

    # Text/generation limits
    max_text_chars: int = field(default_factory=lambda: _env_int("MAX_TEXT_CHARS", 200_000))
    chunk_max_chars: int = field(default_factory=lambda: _env_int("CHUNK_MAX_CHARS", 300))
    chunk_gap_sentence_sec: float = field(default_factory=lambda: _env_float("CHUNK_GAP_SENTENCE_SEC", 0.15))
    chunk_gap_paragraph_sec: float = field(default_factory=lambda: _env_float("CHUNK_GAP_PARAGRAPH_SEC", 0.5))

    # Model / generation defaults
    default_exaggeration: float = field(default_factory=lambda: _env_float("DEFAULT_EXAGGERATION", 0.5))
    default_cfg_weight: float = field(default_factory=lambda: _env_float("DEFAULT_CFG_WEIGHT", 0.5))
    default_language: str = field(default_factory=lambda: _env_str("DEFAULT_LANGUAGE", "en"))

    # Performance
    torch_num_threads: int = field(
        default_factory=lambda: _env_int("TORCH_NUM_THREADS", os.cpu_count() or 4)
    )
    # Inter-op thread pool: parallelizes independent ops within one forward pass.
    # For a single-request CPU inference workload (our case -- one job worker),
    # PyTorch's own guidance is to keep this low (1-2) and let torch_num_threads
    # (intra-op, i.e. within one matmul) do the real parallelization; too many
    # interop threads causes contention rather than speedup here.
    torch_num_interop_threads: int = field(
        default_factory=lambda: _env_int("TORCH_NUM_INTEROP_THREADS", 1)
    )
    # "cuda", "cpu", or "" to auto-detect
    device_override: str = field(default_factory=lambda: _env_str("DEVICE_OVERRIDE", ""))

    # Profiling: log a per-stage timing summary (model load, embedding load,
    # per-chunk inference, post-processing, write) after every generation.
    enable_pipeline_profiling: bool = field(
        default_factory=lambda: _env_bool("ENABLE_PIPELINE_PROFILING", True)
    )

    # Job retention
    job_retention_seconds: int = field(default_factory=lambda: _env_int("JOB_RETENTION_SECONDS", 3600))

    # Quality: auto-retry a chunk if Chatterbox's own repetition-safety cuts it short
    max_chunk_retries: int = field(default_factory=lambda: _env_int("MAX_CHUNK_RETRIES", 1))

    # Post-processing applied to the final stitched audio
    enable_loudness_normalization: bool = field(
        default_factory=lambda: _env_bool("ENABLE_LOUDNESS_NORMALIZATION", True)
    )
    target_lufs: float = field(default_factory=lambda: _env_float("TARGET_LUFS", -19.0))
    enable_silence_trim: bool = field(default_factory=lambda: _env_bool("ENABLE_SILENCE_TRIM", True))
    silence_trim_threshold_db: float = field(
        default_factory=lambda: _env_float("SILENCE_TRIM_THRESHOLD_DB", -50.0)
    )


settings = Settings()
settings.voices_dir.mkdir(exist_ok=True)
settings.output_dir.mkdir(exist_ok=True)
