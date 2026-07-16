import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from . import database, pipeline, zahra_client
from .config import settings
from .exceptions import (
    AvatarAlreadyExistsError,
    AvatarNotFoundError,
    InvalidAvatarNameError,
    InvalidImageError,
    InvalidScriptError,
    JobNotFoundError,
    RenderConfigError,
    RenderFailedError,
    VideoAvatarError,
    ZahraUnavailableError,
    ZahraVoiceError,
)
from .jobs import JobStatus, job_manager
from .logging_config import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


def _start_job_sweeper() -> None:
    def loop():
        while True:
            time.sleep(300)
            job_manager.sweep_expired()

    threading.Thread(target=loop, daemon=True, name="job-sweeper").start()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    database.init_db()
    _start_job_sweeper()
    yield


app = FastAPI(title="Video Avatar Studio", version="1.0.0", lifespan=lifespan)

_ERROR_STATUS = {
    InvalidAvatarNameError: 400,
    InvalidImageError: 400,
    InvalidScriptError: 400,
    AvatarAlreadyExistsError: 409,
    AvatarNotFoundError: 404,
    JobNotFoundError: 404,
    RenderConfigError: 400,
    ZahraUnavailableError: 502,
    ZahraVoiceError: 502,
    RenderFailedError: 500,
}


@app.exception_handler(VideoAvatarError)
async def handle_video_avatar_error(_request, exc: VideoAvatarError):
    status = _ERROR_STATUS.get(type(exc), 500)
    if status == 500:
        logger.error("Unhandled domain error: %s", exc)
    return JSONResponse(status_code=status, content={"detail": str(exc)})


def _safe_name(name: str) -> str:
    cleaned = "".join(c for c in name.strip() if c.isalnum() or c in "-_ ").strip()
    return cleaned.replace(" ", "_")


@app.post("/avatars")
async def create_avatar(name: str = Form(...), image: UploadFile = File(...)):
    safe_name = _safe_name(name)
    if not safe_name:
        raise InvalidAvatarNameError("Avatar name must contain at least one letter, digit, - or _")
    if database.get_avatar_by_name(safe_name):
        raise AvatarAlreadyExistsError(f"Avatar '{safe_name}' already exists")

    ext = Path(image.filename or "avatar.jpg").suffix.lower() or ".jpg"
    if ext not in settings.allowed_image_extensions:
        raise InvalidImageError(
            f"Unsupported image format '{ext}'. Allowed: {', '.join(settings.allowed_image_extensions)}. "
            "Use a clear, front-facing, well-lit photo."
        )

    image_path = settings.avatars_dir / f"{safe_name}{ext}"
    size = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024
    with image_path.open("wb") as f:
        while chunk := await image.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                f.close()
                image_path.unlink(missing_ok=True)
                raise InvalidImageError(f"File exceeds the {settings.max_upload_mb}MB upload limit")
            f.write(chunk)

    avatar_id = database.insert_avatar(safe_name, str(image_path))
    logger.info("Avatar '%s' saved as id=%d (%.1f KB)", safe_name, avatar_id, size / 1024)
    return database.get_avatar(avatar_id)


@app.get("/avatars")
async def get_avatars():
    return database.list_avatars()


@app.get("/avatars/{avatar_id}")
async def get_avatar(avatar_id: int):
    avatar = database.get_avatar(avatar_id)
    if not avatar:
        raise AvatarNotFoundError(f"Avatar {avatar_id} not found")
    return avatar


@app.delete("/avatars/{avatar_id}")
async def remove_avatar(avatar_id: int):
    avatar = database.get_avatar(avatar_id)
    if not avatar:
        raise AvatarNotFoundError(f"Avatar {avatar_id} not found")
    Path(avatar["image_path"]).unlink(missing_ok=True)
    database.delete_avatar(avatar_id)
    logger.info("Deleted avatar id=%d (%s)", avatar_id, avatar["name"])
    return {"deleted": avatar_id}


@app.get("/voices")
async def get_voices():
    """Proxies Zahra Studio's voice list so the frontend only needs one API."""
    return zahra_client.list_voices()


@app.post("/generate-video", status_code=202)
async def generate_video(
    script: str = Form(...),
    avatar_id: int = Form(...),
    voice_id: int = Form(...),
    backend: str = Form(None),
):
    if not script.strip():
        raise InvalidScriptError("Script is required")
    if len(script) > settings.max_script_chars:
        raise InvalidScriptError(
            f"Script is {len(script)} characters, which exceeds the limit of "
            f"{settings.max_script_chars}. Split it into multiple videos."
        )
    if not database.get_avatar(avatar_id):
        raise AvatarNotFoundError(f"Avatar {avatar_id} not found")

    def work(on_stage):
        return pipeline.generate_video(script, avatar_id, voice_id, backend, on_stage=on_stage)

    job_id = job_manager.submit(work)
    logger.info(
        "Queued video job %s for avatar_id=%d voice_id=%d (%d chars)",
        job_id, avatar_id, voice_id, len(script),
    )
    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = job_manager.get(job_id)
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found")
    return {
        "id": job.id,
        "status": job.status,
        "stage": job.stage,
        "error": job.error,
    }


@app.get("/jobs/{job_id}/download")
async def download_job(job_id: str):
    job = job_manager.get(job_id)
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found")
    if job.status != JobStatus.DONE:
        raise HTTPException(409, f"Job is not finished yet (status={job.status})")
    return FileResponse(job.result_path, media_type="video/mp4", filename=job.result_path.name)
