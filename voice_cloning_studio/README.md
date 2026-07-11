# Voice Cloning Studio

A local voice-cloning text-to-speech app: FastAPI backend + SQLite for saved
voices, Gradio frontend. Clone a voice from a short reference clip once, then
generate narration in that voice from any script, in 23 languages.

**Engine note:** built with [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox)
(Resemble AI, MIT licensed — free for commercial use) instead of Coqui XTTS v2.
XTTS v2's license (CPML) restricts commercial use and the company that sold
commercial licenses no longer exists, which is a real problem for monetized
YouTube content — Chatterbox has no such restriction. Because of this engine
swap, there's no `COQUI_TOS_AGREED` handling (that's specific to the original
Coqui `TTS` package's XTTS download gate, which doesn't apply here).

## Project structure

```
backend/            FastAPI app, Chatterbox wrapper, SQLite access
frontend/           Gradio UI (talks to the backend over HTTP)
voices/             saved reference clips + embeddings (created at runtime, git-ignored)
output/             generated audio files (created at runtime, git-ignored)
requirements.txt
```

## Setup

Needs Python 3.10-3.13 (not 3.14 yet — some dependencies don't have prebuilt
Windows/Mac wheels for it yet, which forces slow/broken source builds).

```
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # macOS/Linux

pip install -r requirements.txt
```

This pulls in PyTorch and the Chatterbox model libraries — several GB on
first install. A GPU (NVIDIA/CUDA) is auto-detected and used if available;
otherwise it falls back to CPU, which is much slower for long scripts.

## Run

Two processes, in separate terminals (both from the project root, with the
venv activated in each):

```
# Terminal 1 — backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
python frontend/gradio_app.py
```

Open the Gradio URL it prints (typically `http://127.0.0.1:7860`).

## Using it

**Clone New Voice tab:** upload a clean ~10-20 second solo clip of the voice,
give it a name, click Save. This computes and stores the voice embedding
(`voices/<name>.conds.pt`) plus a DB row — the model doesn't need to re-read
the original clip on future generations.

**Generate Speech tab:** pick a saved voice, paste your script, choose a
language, click Generate. Long scripts are automatically split into chunks
internally (the underlying model can only generate a limited amount of audio
per call) and stitched back into one WAV file — you always get a single
downloadable file back regardless of script length.

Only clone voices you have the right to clone — your own voice, or a voice
you have explicit permission to use.

## API reference

- `POST /clone-voice` — form fields `name` (str), `audio` (file). Returns the saved voice record.
- `GET /voices` — list saved voices.
- `GET /languages` — supported language codes/names.
- `POST /generate-speech` — form fields `text`, `voice_id`, `language` (default `en`),
  `exaggeration` (default 0.5), `cfg_weight` (default 0.5). Returns a `.wav` file.
