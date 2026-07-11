import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from . import audio_utils, database, tts_engine

PROJECT_ROOT = Path(__file__).resolve().parent.parent
VOICES_DIR = PROJECT_ROOT / "voices"
OUTPUT_DIR = PROJECT_ROOT / "output"
VOICES_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Voice Cloning Studio")


@app.on_event("startup")
def on_startup() -> None:
    database.init_db()


def _safe_name(name: str) -> str:
    cleaned = "".join(c for c in name.strip() if c.isalnum() or c in "-_ ").strip()
    return cleaned.replace(" ", "_")


@app.post("/clone-voice")
async def clone_voice(name: str = Form(...), audio: UploadFile = File(...)):
    safe_name = _safe_name(name)
    if not safe_name:
        raise HTTPException(400, "Invalid voice name")
    if database.get_voice_by_name(safe_name):
        raise HTTPException(409, f"Voice '{safe_name}' already exists")

    ext = Path(audio.filename or "voice.wav").suffix or ".wav"
    audio_path = VOICES_DIR / f"{safe_name}{ext}"
    with audio_path.open("wb") as f:
        shutil.copyfileobj(audio.file, f)

    embedding_path = VOICES_DIR / f"{safe_name}.conds.pt"
    try:
        tts_engine.extract_and_save_embedding(str(audio_path), str(embedding_path))
    except Exception as e:
        audio_path.unlink(missing_ok=True)
        raise HTTPException(500, f"Failed to process reference audio: {e}")

    voice_id = database.insert_voice(safe_name, str(audio_path), str(embedding_path))
    return database.get_voice(voice_id)


@app.get("/voices")
async def get_voices():
    return database.list_voices()


@app.get("/languages")
async def get_languages():
    return tts_engine.get_supported_languages()


@app.post("/generate-speech")
async def generate_speech(
    text: str = Form(...),
    voice_id: int = Form(...),
    language: str = Form("en"),
    exaggeration: float = Form(0.5),
    cfg_weight: float = Form(0.5),
):
    if not text.strip():
        raise HTTPException(400, "Text is required")

    voice = database.get_voice(voice_id)
    if not voice:
        raise HTTPException(404, "Voice not found")

    try:
        samples, sample_rate = audio_utils.generate_long_form(
            text,
            voice["embedding_path"],
            language_id=language,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    out_path = OUTPUT_DIR / f"{uuid.uuid4().hex}.wav"
    audio_utils.save_wav(samples, sample_rate, out_path)

    return FileResponse(out_path, media_type="audio/wav", filename=out_path.name)
