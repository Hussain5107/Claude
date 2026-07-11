# Zahra Studio

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
  gradio_app.py          UI: clone/manage voices, test-tune settings, queue+batch generate
  assets/logo.svg         Zahra Studio logo
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

**Test Voice tab:** before committing to a full script, generate a short
sentence (editable, a sensible default is prefilled) with a given
exaggeration/pace setting to hear how it actually sounds — far faster than
finding out 40 minutes into a full render that the settings are off.
Selecting a voice auto-fills its last-saved settings if you've saved any;
**"Save these as default settings for this voice"** remembers them for next
time. Once you're happy, use **"Copy voice + settings from Test Voice"** in
Generate Speech instead of re-entering everything.

**Generate Speech tab:** a queue, not a single one-shot generation. Add a
script (per voice, with its own language/exaggeration/pace) to the queue —
the box shows a live word count and estimated narrated duration as you type
— repeat for as many voices/scripts as you want, then hit **Generate All**.
The queue table shows live status and percentage progress per item as they
render; completed files (audio **and** an auto-generated `.srt` caption
file) appear for download as soon as each one finishes, you don't have to
wait for the whole batch. Use the **Item # / Move up / Move down / Load for
editing** controls to reorder the queue or pull an item back into the form
to change it before it's generated.

Note on "multiple voices at once": the queue lets you *submit* many jobs
without waiting on each one, but they still render one at a time under the
hood — the model isn't safe to call from two threads simultaneously, and
running multiple full copies of it in parallel isn't realistic on a CPU-only
machine anyway. The queue is what makes this not feel like a limitation:
submit everything up front, walk away, come back to a folder of finished
files instead of babysitting one generation at a time.

## API reference

- `POST /clone-voice` — form fields `name` (str), `audio` (file, one of
  `.wav .mp3 .m4a .flac .ogg .aac`, up to `MAX_UPLOAD_MB`). Returns the saved
  voice record.
- `GET /voices` — list saved voices.
- `GET /voices/{voice_id}` — a single voice record (includes
  `default_exaggeration` / `default_cfg_weight` / `default_language` if set).
- `PATCH /voices/{voice_id}/defaults` — JSON body `{exaggeration, cfg_weight,
  language}`. Saves them as that voice's remembered settings.
- `DELETE /voices/{voice_id}` — delete a saved voice and its files.
- `GET /languages` — supported language codes/names.
- `POST /generate-speech` — form fields `text`, `voice_id`, `language`
  (default from config), `exaggeration`, `cfg_weight` (defaults from config).
  Returns `202 {"job_id": "..."}`.
- `GET /jobs/{job_id}` — `{"status": "queued"|"running"|"done"|"failed",
  "chunks_done": N, "chunks_total": N, "error": "..." | null, "has_captions": bool}`.
- `GET /jobs/{job_id}/download` — the finished `.wav` (409 if not done yet).
- `GET /jobs/{job_id}/captions` — the auto-generated `.srt` captions for that
  job (409 if not done yet, 404 if somehow unavailable).

## Development

```
pip install -r requirements-dev.txt   # adds pytest, httpx, ruff on top of requirements.txt
pytest                                 # runs in seconds -- torch/chatterbox are mocked, no GPU needed
ruff check .                           # lint
```

Tests never download model weights or need a GPU: `tests/conftest.py` stubs
only `chatterbox` in `sys.modules` (the part that needs several GB of
weights) before anything is imported. `torch`/`torchaudio`/`numpy`/
`pyloudnorm` are kept **real** (ordinary installs, no model download) so the
audio post-processing logic (silence trimming, loudness normalization,
caption timing) is tested against actual tensor/array math, not a mock —
see `.github/workflows/voice_cloning_studio-ci.yml`.

## Quality/output features

- **Auto-retry on repetition cutoff:** Chatterbox has a built-in safety net
  that force-stops a chunk early if it detects itself repeating a sound.
  Sampling is stochastic, so `tts_engine.generate_chunk` now automatically
  retries a truncated chunk (`MAX_CHUNK_RETRIES`, default 1) before giving up
  and keeping the best available result.
- **Post-processing:** the final stitched audio is loudness-normalized
  (target `-19 LUFS` by default, tunable) and has leading/trailing silence
  trimmed — both configurable/disable-able via `.env.example`.
- **Captions:** every generation also produces a `.srt` file, timed from the
  actual generated audio duration of each chunk (not guessed from text
  length), so timing is accurate without needing a separate speech-to-text
  pass.

## Known limitations

- CPU-only generation is slow and proportional to script length; no built-in
  GPU rental/offload path yet.
- No authentication on the local API — it's meant for `localhost` only, don't
  expose it to a network without adding auth in front of it.
- The queue reorder/edit UI is intentionally simple (move up/down, load one
  item back into the form) rather than drag-and-drop, which Gradio doesn't
  support natively.

See `PROJECT_BRIEF.md` (repo root) for the fuller build history and roadmap.

## License

MIT — see `LICENSE`. Chatterbox itself is also MIT licensed.
