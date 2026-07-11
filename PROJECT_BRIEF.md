# Project Brief: Voice Note / Cloning Tools

## Goal
Turn text scripts into natural-sounding narration audio for YouTube — ideally
in the user's own cloned voice, running locally/free/unlimited, no per-use
API costs.

## Timeline of what we built (and why each pivot happened)

1. **`voice_note.py`** — single script, edge-tts (Microsoft's free neural
   voices, no API key). Works, but stock voices only, not a cloned voice.

2. **`offline_voice_studio.html`** — self-contained webpage, Kokoro neural
   TTS running fully in-browser via WASM/WebGPU. Fully offline after first
   load, exports long-form WAV in parts. Still stock voices, not cloned —
   Kokoro doesn't support arbitrary voice cloning.

3. **`clone_server.py` + `cloned_voice_studio.html`** — first cloning
   prototype. Confirmed the reference clip was the user's own voice (consent
   check) before building. Uses Chatterbox (Resemble AI, MIT license — chosen
   over Coqui XTTS v2 specifically because XTTS's license restricts
   commercial use and the company that would sell a commercial license no
   longer exists, which matters for a monetized YouTube channel). Runs as a
   local Flask server (cloning models are too heavy for in-browser WASM)
   with a matching webpage frontend.

4. **`voice_cloning_studio/`** — the current, "real" app. User asked for a
   structured FastAPI + SQLite + Gradio build modeled on Coqui XTTS v2; we
   kept that exact architecture but swapped the engine to Chatterbox
   Multilingual (same licensing reasoning as step 3), which also unlocked
   23-language support and proper saved voice embeddings (clone once, reuse
   forever, no need to re-upload the reference clip).

   - `backend/` — FastAPI app:
     - `POST /clone-voice` — upload clip + name → extracts & saves a speaker
       embedding (`Conditionals`) to `voices/`, records it in SQLite.
     - `GET /voices` — list saved voices.
     - `POST /generate-speech` — text + voice + language → chunks long text
       internally, generates each chunk, stitches into one WAV, returns it.
     - `database.py` — plain sqlite3, one `voices` table.
     - `tts_engine.py` — Chatterbox singleton + embedding save/load.
   - `frontend/gradio_app.py` — two tabs (Clone New Voice / Generate Speech),
     talks to the backend over HTTP.
   - `start_backend.bat` / `start_frontend.bat` — one-click launchers
     (self-locating via `%~dp0`, create/reuse the venv, install deps, run) —
     added after a lot of manual setup friction (see below).

## Debugging history (useful if similar errors resurface)

- **Python 3.14 incompatible** — `spacy-pkuseg` (a Chatterbox dependency,
  used for Chinese/Japanese text segmentation) has no prebuilt Windows wheel
  for 3.14 yet, forcing a from-source build that needs a C++ compiler we
  didn't have. Fixed by using **Python 3.12** in a dedicated venv instead.
- **`'NoneType' object is not callable` on `perth.PerthImplicitWatermarker()`**
  — happened twice, two different causes:
  1. Python 3.12's `venv` no longer bundles `setuptools`, so `pkg_resources`
     (which `resemble-perth`'s watermarker still imports) was missing entirely.
  2. After installing latest `setuptools` (83.0.0), it turned out that version
     **removed `pkg_resources` completely** — broke it again, differently.
  - Fixed by pinning **`setuptools<81`** in `requirements.txt` (confirmed
    79.0.1 still ships `pkg_resources`).
- **Windows path/shell friction** — `cd` alone doesn't switch drives in
  Command Prompt (needs `cd /d`); PowerShell doesn't support `cd /d` at all
  but switches drives fine with plain `cd`; PowerShell needs
  `Activate.ps1` (not `activate.bat`) and may need
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. Several stray
  venvs got created in the wrong folders along the way. The `.bat` launchers
  route around all of this by using `%~dp0` to always operate on their own
  folder, and by being `.bat` files (run identically from cmd or PowerShell,
  no execution-policy prompts).

## Current state (working)

- Voice cloning confirmed working end-to-end on the user's Windows machine
  (CPU-only, no dedicated GPU) — clone once, generate unlimited times, no
  cost, MIT-licensed (commercial-use safe).
- Generation speed is proportional to script length and stays roughly
  constant per run; CPU-only means long scripts (30-60 min) take
  significant real time.
- A built-in safety mechanism in Chatterbox sometimes cuts a chunk short if
  it detects the model repeating itself — occasionally produces a slightly
  truncated sentence.

## Known limitations / rough edges

- No progress indicator during generation beyond raw console logs — long
  runs can feel like they've stalled.
- Occasional truncated chunks from the repetition-safety cutoff (not yet
  auto-retried).
- Single reference clip per voice; no re-training or refinement over time.
- No audio post-processing (loudness normalization, silence trimming) —
  output is raw model audio.
- No auth on the local server (fine for localhost-only, don't expose it to
  a network).
- Chunking is sentence/paragraph-based and fixed-size; not tuned per voice.

## Ideas for "next level"

- **Progress UI**: stream chunk-by-chunk progress into the Gradio tab
  (similar to what `offline_voice_studio.html` already does) instead of a
  silent spinner.
- **Auto-retry truncated chunks**: detect the repetition-cutoff warning and
  regenerate that chunk automatically (maybe with slightly different
  sampling settings) instead of shipping a clipped sentence.
- **Audio post-processing pass**: normalize loudness, trim silence,
  optionally export directly to MP3 for smaller YouTube-ready files.
- **Auto-captions**: run the generated audio through a speech-to-text
  aligner to produce a `.srt` file alongside the WAV — useful for YouTube
  captions/subtitles.
- **GPU path**: if a GPU (local or a rented cloud GPU) becomes available,
  document/streamline switching `device` for a large speed win on long
  scripts.
- **Packaging**: turn the manual venv setup into a proper installer
  (e.g. PyInstaller) so there's no Python/venv step at all for future setup
  or for sharing with someone else.
- **Multi-speaker scripts**: support scripts with multiple cloned voices
  (e.g. dialogue) generated in one pass.
