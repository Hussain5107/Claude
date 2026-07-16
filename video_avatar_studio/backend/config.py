"""Centralized, environment-driven configuration.

Mirrors the config pattern used by the sibling voice_cloning_studio project:
every tunable lives here, reads from the process environment (and a local
.env file if python-dotenv is available), all with sensible defaults.
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


def _env_bool(key: str, default: bool) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    # Paths
    avatars_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "avatars")
    output_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "output")
    db_path: Path = field(default_factory=lambda: PROJECT_ROOT / "avatars.db")

    log_level: str = field(default_factory=lambda: _env_str("LOG_LEVEL", "INFO"))

    # Upload validation
    allowed_image_extensions: tuple = (".jpg", ".jpeg", ".png", ".webp")
    allowed_video_extensions: tuple = (".mp4", ".mov", ".webm")
    max_upload_mb: int = field(default_factory=lambda: _env_int("MAX_UPLOAD_MB", 50))
    max_script_chars: int = field(default_factory=lambda: _env_int("MAX_SCRIPT_CHARS", 20_000))

    # Zahra Studio (voice cloning backend) connection
    zahra_api_url: str = field(default_factory=lambda: _env_str("ZAHRA_API_URL", "http://localhost:8000"))
    zahra_request_timeout: int = field(default_factory=lambda: _env_int("ZAHRA_REQUEST_TIMEOUT", 30))
    zahra_poll_interval_sec: float = field(
        default_factory=lambda: float(_env_str("ZAHRA_POLL_INTERVAL_SEC", "2.0"))
    )

    # Replicate (talking-head render backend)
    replicate_api_token: str = field(default_factory=lambda: _env_str("REPLICATE_API_TOKEN", ""))
    # "sadtalker" (single photo, natural head motion, cheaper) or
    # "musetalk" (higher fidelity lip-sync, needs a closer-cropped reference image)
    render_backend: str = field(default_factory=lambda: _env_str("RENDER_BACKEND", "sadtalker"))
    render_poll_interval_sec: float = field(
        default_factory=lambda: float(_env_str("RENDER_POLL_INTERVAL_SEC", "3.0"))
    )
    render_timeout_sec: int = field(default_factory=lambda: _env_int("RENDER_TIMEOUT_SEC", 1800))

    # Job retention
    job_retention_seconds: int = field(default_factory=lambda: _env_int("JOB_RETENTION_SECONDS", 3600))


settings = Settings()
settings.avatars_dir.mkdir(exist_ok=True)
settings.output_dir.mkdir(exist_ok=True)
