import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from . import audio_utils, database, tts_engine
from .config import settings
from .exceptions import (
    InvalidAudioError,
    InvalidTextError,
    InvalidVoiceNameError,
    JobNotFoundError,
    VoiceAlreadyExistsError,
    VoiceNotFoundError,
    VoiceProcessingError,
    VoiceStudioError,
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


app = FastAPI(title="Voice Cloning Studio", version="1.0.0", lifespan=lifespan)

_ERROR_STATUS = {
    InvalidVoiceNameError: 400,
    InvalidAudioError: 400,
    InvalidTextError: 400,
    VoiceAlreadyExistsError: 409,
    VoiceNotFoundError: 404,
    JobNotFoundError: 404,
    VoiceProcessingError: 500,
}


@app.exception_handler(VoiceStudioError)
async def handle_voice_studio_error(_request, exc: VoiceStudioError):
    status = _ERROR_STATUS.get(type(exc), 500)
    if status == 500:
        logger.error("Unhandled domain error: %s", exc)
    return JSONResponse(status_code=status, content={"detail": str(exc)})


def _safe_name(name: str) -> str:
    cleaned = "".join(c for c in name.strip() if c.isalnum() or c in "-_ ").strip()
    return cleaned.replace(" ", "_")


@app.post("/clone-voice")
async def clone_voice(name: str = Form(...), audio: UploadFile = File(...)):
    safe_name = _safe_name(name)
    if not safe_name:
        raise InvalidVoiceNameError("Voice name must contain at least one letter, digit, - or _")
    if database.get_voice_by_name(safe_name):
        raise VoiceAlreadyExistsError(f"Voice '{safe_name}' already exists")

    ext = Path(audio.filename or "voice.wav").suffix.lower() or ".wav"
    if ext not in settings.allowed_audio_extensions:
        raise InvalidAudioError(
            f"Unsupported audio format '{ext}'. Allowed: {', '.join(settings.allowed_audio_extensions)}"
        )

    audio_path = settings.voices_dir / f"{safe_name}{ext}"
    size = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024
    with audio_path.open("wb") as f:
        while chunk := await audio.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                f.close()
                audio_path.unlink(missing_ok=True)
                raise InvalidAudioError(f"File exceeds the {settings.max_upload_mb}MB upload limit")
            f.write(chunk)

    logger.info("Cloning voice '%s' from %s (%.1f KB)", safe_name, ext, size / 1024)

    embedding_path = settings.voices_dir / f"{safe_name}.conds.pt"
    try:
        tts_engine.extract_and_save_embedding(str(audio_path), str(embedding_path))
    except VoiceProcessingError:
        audio_path.unlink(missing_ok=True)
        raise

    voice_id = database.insert_voice(safe_name, str(audio_path), str(embedding_path))
    logger.info("Voice '%s' saved as id=%d", safe_name, voice_id)
    return database.get_voice(voice_id)


@app.get("/voices")
async def get_voices():
    return database.list_voices()


@app.delete("/voices/{voice_id}")
async def remove_voice(voice_id: int):
    voice = database.get_voice(voice_id)
    if not voice:
        raise VoiceNotFoundError(f"Voice {voice_id} not found")

    Path(voice["audio_path"]).unlink(missing_ok=True)
    Path(voice["embedding_path"]).unlink(missing_ok=True)
    database.delete_voice(voice_id)
    logger.info("Deleted voice id=%d (%s)", voice_id, voice["name"])
    return {"deleted": voice_id}


@app.get("/languages")
async def get_languages():
    return tts_engine.get_supported_languages()


@app.post("/generate-speech", status_code=202)
async def generate_speech(
    text: str = Form(...),
    voice_id: int = Form(...),
    language: str = Form(None),
    exaggeration: float = Form(None),
    cfg_weight: float = Form(None),
):
    if not text.strip():
        raise InvalidTextError("Text is required")
    if len(text) > settings.max_text_chars:
        raise InvalidTextError(
            f"Script is {len(text)} characters, which exceeds the limit of "
            f"{settings.max_text_chars}. Split it into multiple generations."
        )

    voice = database.get_voice(voice_id)
    if not voice:
        raise VoiceNotFoundError(f"Voice {voice_id} not found")

    language = language or settings.default_language
    exaggeration = settings.default_exaggeration if exaggeration is None else exaggeration
    cfg_weight = settings.default_cfg_weight if cfg_weight is None else cfg_weight

    out_path = settings.output_dir / f"{uuid.uuid4().hex}.wav"

    def work(on_progress):
        samples, sample_rate = audio_utils.generate_long_form(
            text,
            voice["embedding_path"],
            language_id=language,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            on_progress=on_progress,
        )
        audio_utils.save_wav(samples, sample_rate, out_path)
        return out_path

    job_id = job_manager.submit(work)
    logger.info("Queued generation job %s for voice_id=%d (%d chars)", job_id, voice_id, len(text))
    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = job_manager.get(job_id)
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found")
    return {
        "id": job.id,
        "status": job.status,
        "chunks_done": job.chunks_done,
        "chunks_total": job.chunks_total,
        "error": job.error,
    }


@app.get("/jobs/{job_id}/download")
async def download_job(job_id: str):
    job = job_manager.get(job_id)
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found")
    if job.status != JobStatus.DONE:
        raise HTTPException(409, f"Job is not finished yet (status={job.status})")
    return FileResponse(job.result_path, media_type="audio/wav", filename=job.result_path.name)
