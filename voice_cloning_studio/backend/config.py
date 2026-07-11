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
    # "cuda", "cpu", or "" to auto-detect
    device_override: str = field(default_factory=lambda: _env_str("DEVICE_OVERRIDE", ""))

    # Job retention
    job_retention_seconds: int = field(default_factory=lambda: _env_int("JOB_RETENTION_SECONDS", 3600))


settings = Settings()
settings.voices_dir.mkdir(exist_ok=True)
settings.output_dir.mkdir(exist_ok=True)
