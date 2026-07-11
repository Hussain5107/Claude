# Voice Cloning Studio

A local voice-cloning text-to-speech app: FastAPI backend + SQLite for saved
voices, Gradio frontend. Clone a voice from a short reference clip once, then
generate narration in that voice from any script, in 23 languages — free,
unlimited, runs entirely on your own machine.

**Engine note:** built with [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox)
(Resemble AI, MIT licensed — free for commercial use) instead of Coqui XTTS v2.
XTTS v2's license (CPML) restricts commercial use and the company that sold
commercial licenses no longer exists, which is a real problem for monetized
YouTube content — Chatterbox has no such restriction.

Only clone voices you have the right to clone — your own voice, or a voice
you have explicit permission to use.

## Architecture

```
backend/
  main.py              FastAPI routes, request validation, error mapping
  config.py             all tunables, env-var driven (see .env.example)
  logging_config.py     structured logging setup
  exceptions.py         domain error types -> HTTP status mapping
  database.py            SQLite access (one `voices` table)
  tts_engine.py          Chatterbox model singleton + embedding load/save
  audio_utils.py         text chunking + long-form generation orchestration
  jobs.py                 background job manager (generation runs off the request thread)
frontend/
  gradio_app.py          UI: clone/manage voices, generate speech, polls job progress
tests/                    pytest suite (torch/chatterbox mocked -- no GPU/heavy install needed)
voices/                  saved reference clips + embeddings (created at runtime, git-ignored)
output/                  generated audio files (created at runtime, git-ignored)
```

**Generation is a background job, not a blocking request.** A 30-60 minute
script can take a long time on CPU — far too long for a single HTTP request.
`POST /generate-speech` queues the work and returns immediately with a
`job_id`; the client polls `GET /jobs/{id}` for live chunk-by-chunk progress,
then downloads the result once it's done. This is also why generation runs on
a single dedicated worker thread rather than the request-handling threads:
the model isn't safe to call from multiple threads at once.

## Setup

Needs Python 3.10-3.13 (not 3.14 yet — some dependencies don't have prebuilt
Windows/Mac wheels for it yet, which forces slow/broken source builds).

**Windows — easiest path:** double-click `start_backend.bat`, then
`start_frontend.bat`. They create/reuse the venv and install dependencies
automatically; see [Run](#run) below for what happens next.

**Manual setup (any OS):**
```
python -m venv venv
venv\Scripts\activate      # Windows (cmd)
# .\venv\Scripts\Activate.ps1  # Windows (PowerShell)
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
```

This pulls in PyTorch and the Chatterbox model libraries — several GB on
first install. A GPU (NVIDIA/CUDA) is auto-detected and used if available;
otherwise it falls back to CPU, which is much slower for long scripts.

### Configuration

Copy `.env.example` to `.env` to override any default (chunk size, text
length limit, upload size limit, generation defaults, thread count, forced
device, job retention). Every setting has a working default — this is only
needed to tune behavior. See `.env.example` for the full list with
descriptions.

## Run

Windows: `start_backend.bat` then `start_frontend.bat` (separate windows).
macOS/Linux: `./start_backend.sh` then `./start_frontend.sh`.

Or manually, two processes in separate terminals (both from the project
root, with the venv activated in each):

```
# Terminal 1 — backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
python frontend/gradio_app.py
```

Open the Gradio URL it prints (typically `http://127.0.0.1:7860`). Interactive
API docs are auto-served at `http://localhost:8000/docs`.

## Using it

**Clone New Voice tab:** upload a clean ~10-20 second solo clip of the voice,
give it a name, click Save. This computes and stores the voice embedding
(`voices/<name>.conds.pt`) plus a DB row — the model doesn't need to re-read
the original clip on future generations. You can delete a saved voice from
the same tab.

**Generate Speech tab:** pick a saved voice, paste your script, choose a
language, click Generate. Long scripts are automatically split into chunks
internally (the underlying model can only generate a limited amount of audio
per call) and stitched back into one WAV file — you always get a single
downloadable file back regardless of script length, with live progress shown
while it works.

## API reference

- `POST /clone-voice` — form fields `name` (str), `audio` (file, one of
  `.wav .mp3 .m4a .flac .ogg .aac`, up to `MAX_UPLOAD_MB`). Returns the saved
  voice record.
- `GET /voices` — list saved voices.
- `DELETE /voices/{voice_id}` — delete a saved voice and its files.
- `GET /languages` — supported language codes/names.
- `POST /generate-speech` — form fields `text`, `voice_id`, `language`
  (default from config), `exaggeration`, `cfg_weight` (defaults from config).
  Returns `202 {"job_id": "..."}`.
- `GET /jobs/{job_id}` — `{"status": "queued"|"running"|"done"|"failed",
  "chunks_done": N, "chunks_total": N, "error": "..." | null}`.
- `GET /jobs/{job_id}/download` — the finished `.wav` (409 if not done yet).

## Development

```
pip install -r requirements-dev.txt   # adds pytest, httpx, ruff on top of requirements.txt
pytest                                 # runs in seconds -- torch/chatterbox are mocked, no GPU needed
ruff check .                           # lint
```

Tests never load the real model or download weights: `tests/conftest.py`
stubs `torch`/`torchaudio`/`chatterbox` in `sys.modules` before anything is
imported, so the whole suite (chunking logic, job state machine, SQLite
layer, full HTTP request/response contract) runs anywhere, including CI —
see `.github/workflows/voice_cloning_studio-ci.yml`.

## Known limitations

- CPU-only generation is slow and proportional to script length; no built-in
  GPU rental/offload path yet.
- A built-in Chatterbox safety mechanism occasionally cuts a chunk short if
  it detects the model repeating itself — rare, but can produce a slightly
  truncated sentence. Not yet auto-retried.
- No authentication on the local API — it's meant for `localhost` only, don't
  expose it to a network without adding auth in front of it.
- No audio post-processing (loudness normalization, silence trimming, MP3
  export) — output is the raw model WAV.

See `PROJECT_BRIEF.md` (repo root) for the fuller build history and a longer
roadmap of next-level ideas (auto-captions, GPU path, packaging, etc).

## License

MIT — see `LICENSE`. Chatterbox itself is also MIT licensed.
