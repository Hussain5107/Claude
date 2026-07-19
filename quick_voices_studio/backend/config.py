"""Configuration for Quick Voices Studio, env-var driven like the main app."""

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_str(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _env_float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


@dataclass
class Settings:
    voices_dir: Path = field(default_factory=lambda: BASE_DIR / _env_str("QV_VOICES_DIR", "voices"))
    output_dir: Path = field(default_factory=lambda: BASE_DIR / _env_str("QV_OUTPUT_DIR", "output"))
    log_level: str = field(default_factory=lambda: _env_str("QV_LOG_LEVEL", "INFO"))
    max_text_chars: int = field(default_factory=lambda: _env_int("QV_MAX_TEXT_CHARS", 200_000))
    chunk_max_chars: int = field(default_factory=lambda: _env_int("QV_CHUNK_MAX_CHARS", 400))
    default_length_scale: float = field(default_factory=lambda: _env_float("QV_DEFAULT_LENGTH_SCALE", 1.0))
    job_retention_seconds: int = field(default_factory=lambda: _env_int("QV_JOB_RETENTION_SECONDS", 3600))

    def __post_init__(self) -> None:
        self.voices_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
