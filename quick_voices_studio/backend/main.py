"""Quick Voices Studio backend: fixed pre-trained voices, no cloning.

A lightweight sibling to the main Zahra Studio app. No multi-GB models, no
reference-audio upload, no GPU needed -- just pick a voice and generate.
"""

import logging
import uuid

from fastapi import FastAPI, Form
from fastapi.responses import FileResponse, JSONResponse

from . import audio_utils, tts_engine
from .config import settings
from .exceptions import QuickVoicesError
from .jobs import Job, job_manager
from .voice_catalog import CATALOG, get_voice, list_languages

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("quick_voices.main")

app = FastAPI(title="Quick Voices Studio")


@app.exception_handler(QuickVoicesError)
async def handle_domain_error(request, exc: QuickVoicesError):  # noqa: ANN001, ARG001
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


@app.get("/voices")
def voices():
    return [
        {
            "code": v.code,
            "label": v.label,
            "language": v.language,
            "language_label": v.language_label,
            "downloaded": tts_engine.is_voice_downloaded(v.code),
        }
        for v in CATALOG
    ]


@app.get("/languages")
def languages():
    return [{"code": code, "label": label} for code, label in list_languages()]


@app.post("/generate-speech", status_code=202)
def generate_speech(
    text: str = Form(...),
    voice_code: str = Form(...),
    length_scale: float = Form(1.0),
    noise_scale: float | None = Form(None),
    noise_w_scale: float | None = Form(None),
    pitch_semitones: float = Form(0.0),
    warmth_db: float = Form(0.0),
    reverb_amount: float = Form(0.0),
):
    if get_voice(voice_code) is None:
        return JSONResponse(status_code=404, content={"detail": f"Unknown voice '{voice_code}'"})

    out_path = settings.output_dir / f"{uuid.uuid4()}.wav"

    def work(job: Job):
        def on_progress(done: int, total: int) -> None:
            job.chunks_done = done
            job.chunks_total = total

        audio_utils.generate_long_form(
            text,
            voice_code,
            out_path,
            length_scale=length_scale,
            noise_scale=noise_scale,
            noise_w_scale=noise_w_scale,
            pitch_semitones=pitch_semitones,
            warmth_db=warmth_db,
            reverb_amount=reverb_amount,
            on_progress=on_progress,
        )
        return out_path

    job_id = job_manager.submit(work)
    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    job = job_manager.get(job_id)
    return {
        "id": job.id,
        "status": job.status,
        "chunks_done": job.chunks_done,
        "chunks_total": job.chunks_total,
        "error": job.error,
    }


@app.get("/jobs/{job_id}/download")
def job_download(job_id: str):
    job = job_manager.get(job_id)
    if job.status != "done" or job.result_path is None:
        return JSONResponse(status_code=409, content={"detail": "Job is not finished yet."})
    return FileResponse(job.result_path, media_type="audio/wav", filename=f"{job_id}.wav")
