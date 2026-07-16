"""Orchestrates script -> cloned-voice narration -> rendered talking-head video."""

import uuid
from pathlib import Path
from typing import Callable

from . import database, render_client, zahra_client
from .config import settings
from .exceptions import AvatarNotFoundError
from .logging_config import get_logger

logger = get_logger(__name__)

OnStage = Callable[[str], None]


def generate_video(
    script_text: str,
    avatar_id: int,
    voice_id: int,
    backend: str | None = None,
    on_stage: OnStage | None = None,
) -> Path:
    avatar = database.get_avatar(avatar_id)
    if not avatar:
        raise AvatarNotFoundError(f"Avatar {avatar_id} not found")

    job_uuid = uuid.uuid4().hex
    audio_path = settings.output_dir / f"{job_uuid}.wav"
    video_path = settings.output_dir / f"{job_uuid}.mp4"

    if on_stage:
        on_stage("narrating")
    logger.info("Generating narration for avatar_id=%d voice_id=%d", avatar_id, voice_id)
    zahra_client.generate_narration(script_text, voice_id, audio_path)

    if on_stage:
        on_stage("rendering")
    logger.info("Rendering talking-head video (backend=%s)", backend or settings.render_backend)
    render_client.render_talking_head(Path(avatar["image_path"]), audio_path, video_path, backend)

    audio_path.unlink(missing_ok=True)
    return video_path
