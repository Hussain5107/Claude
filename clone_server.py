#!/usr/bin/env python3
"""Local server for narrating scripts in your own cloned voice.

Wraps Chatterbox (MIT-licensed, github.com/resemble-ai/chatterbox) for
zero-shot voice cloning from a short reference clip. Serves
cloned_voice_studio.html and a /synthesize endpoint it calls per text chunk.

Only use this with a reference clip you have the right to clone (your own
voice, or a voice you have explicit permission to use).
"""

import io
import os

import torch
import torchaudio
from flask import Flask, request, send_file, send_from_directory

from chatterbox.tts import ChatterboxTTS

REFERENCE_AUDIO = os.environ.get("VOICE_SAMPLE", "voice_sample.mp3")

app = Flask(__name__, static_folder=".", static_url_path="")
_model = None


def get_model() -> ChatterboxTTS:
    global _model
    if _model is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading Chatterbox on {device} (first call downloads model weights)...")
        _model = ChatterboxTTS.from_pretrained(device=device)
    return _model


@app.route("/")
def index():
    return send_from_directory(".", "cloned_voice_studio.html")


@app.route("/status")
def status():
    return {
        "reference_found": os.path.exists(REFERENCE_AUDIO),
        "reference_path": REFERENCE_AUDIO,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
    }


@app.route("/synthesize", methods=["POST"])
def synthesize():
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        return {"error": "empty text"}, 400
    if not os.path.exists(REFERENCE_AUDIO):
        return {"error": f"reference voice file not found: {REFERENCE_AUDIO}"}, 400

    model = get_model()
    wav = model.generate(
        text,
        audio_prompt_path=REFERENCE_AUDIO,
        exaggeration=float(data.get("exaggeration", 0.5)),
        cfg_weight=float(data.get("cfg_weight", 0.5)),
    )

    buf = io.BytesIO()
    torchaudio.save(buf, wav, model.sr, format="wav")
    buf.seek(0)
    return send_file(buf, mimetype="audio/wav")


if __name__ == "__main__":
    print(f"Reference voice file: {REFERENCE_AUDIO} (exists: {os.path.exists(REFERENCE_AUDIO)})")
    print("Open http://localhost:5000 once this is running.")
    app.run(port=5000)
