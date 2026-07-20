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
  profiling.py            per-stage timing / real-time-factor tracking
  database.py            SQLite access (one `voices` table)
  tts_engine.py          Chatterbox model singleton + embedding load/save
  audio_utils.py         text chunking + long-form generation orchestration
  jobs.py                 background job manager (generation runs off the request thread)
  job_store.py            disk-persisted job manifests + per-chunk audio cache, for resume
frontend/
  gradio_app.py          UI: clone/manage voices, test-tune settings, queue+batch generate
  assets/logo.svg         Zahra Studio logo
mcp_server/
  zahra_mcp.py           MCP bridge so Claude Desktop can write + narrate scripts directly
tests/                    pytest suite (only chatterbox mocked -- no GPU/model download needed)
benchmark_pipeline.py     stage-by-stage profiling + before/after benchmark (see Performance below)
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

**Resume tab:** every generation job saves each finished chunk to disk as it
completes, not just to memory. If a job is interrupted -- an error, closing
the terminal window, a laptop sleeping, anything short of deleting the
`output/jobs/` folder -- **Check for unfinished jobs** will find it, showing
the voice, how far it got, and when it started. Hit **Resume** and it
continues from the next chunk that was never generated; chunks already
finished are reused as-is, never redone. This works even after a full
backend restart, since the progress lives on disk, not in the running
process's memory. A job's cache is deleted automatically once it finishes
successfully -- there's nothing to clean up by hand.

## Claude Desktop integration

`mcp_server/` is an MCP bridge so you can write a script *and* narrate it in
one Claude Desktop conversation, instead of switching over to this app's UI
to paste text in. It exposes the same backend API as MCP tools (list
voices, clone a voice, submit/check/wait-for/download a narration). See
`mcp_server/README.md` for setup (it's a one-time Claude Desktop config
change). This only works with the Claude Desktop app — a browser-based
Claude session can't reach a server running on your own machine.

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
- `GET /jobs/resumable` — jobs that started but never finished, each with
  `voice_name`, `chunks_done`/`chunks_total`, `created_at`, `text_preview`.
- `POST /jobs/{job_id}/resume` — continues an unfinished job, regenerating
  only the chunks that never completed. Returns `202 {"job_id": "..."}` (the
  same id); poll `/jobs/{job_id}` exactly as for a fresh submission.

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
- **Mixed-language scripts:** wrap a section in `[xx]...[/xx]` to speak just
  that part in a different language than the rest, e.g. `Hello there.
  [fr]Bonjour tout le monde.[/fr] [es]Hola a todos.[/es]`. Untagged text uses
  whichever language is selected for the generation. Each tagged language
  must be one supported by Chatterbox (23 languages -- see `GET /languages`
  or the app's Language dropdown; notably this does **not** include Urdu or
  Pashto, which the underlying model has no support for at all, cloned
  voice or otherwise).

## Performance

**The top bottleneck, by a wide margin, is the model's own inference** (T3's
autoregressive token-by-token decoding on CPU) — this dominates real
generation time for any script longer than a few seconds, and there's no
optimization in our own code that changes that; it's Chatterbox's own
implementation. What we control is everything *around* inference, and this
was profiled and optimized directly:

- **Threading:** `torch.set_num_threads` (intra-op parallelism, does the
  real work) was already set; added `torch.set_num_interop_threads`
  (`TORCH_NUM_INTEROP_THREADS`, default 1) alongside it -- PyTorch's own
  guidance for a single-request CPU workload like this one is to keep
  inter-op threads low and let intra-op threads do the parallelizing, since
  extra inter-op threads just add contention here.
- **Eliminated redundant work:** the voice embedding is loaded from disk
  once per job and reused across every chunk (an earlier version reloaded
  it per chunk).
- **Streaming, verified with a real benchmark, not assumed:** chunks stream
  directly to the output file as they're generated when no post-processing
  is needed, instead of buffering the whole script in memory --
  `benchmark_pipeline.py` (synthetic model, real memory measurement) shows
  **~60-90% peak memory reduction** for this case depending on script
  length. When post-processing (loudness normalization) *is* enabled (the
  default), it inherently needs the whole signal in memory regardless of
  write strategy, so streaming doesn't help there -- an earlier attempt to
  stream-then-read-back for that case was actually *worse* (extra disk I/O
  plus a redundant dtype conversion), caught by the same benchmark and
  reverted in favor of just buffering directly, matching what pyloudnorm
  needs anyway. A separate real fix in that path removed a redundant
  float64 copy we were making before pyloudnorm's own (necessary) one.
- **Built-in profiling:** every generation logs a stage-by-stage timing
  breakdown (model load, embedding load, per-chunk inference, write,
  post-processing, total, and real-time factor) when
  `ENABLE_PIPELINE_PROFILING` is on (default) -- see `backend/profiling.py`.

**Run the benchmark yourself:**
```
python benchmark_pipeline.py                       # synthetic model, default ~3000 words
python benchmark_pipeline.py --words 9000           # longer synthetic script
python benchmark_pipeline.py --real --embedding-path voices/<name>.conds.pt   # real model, real RTF
```
The synthetic mode (default) measures our own orchestration overhead in a
way that's reproducible on any machine, by substituting a controlled
stand-in for model inference. It cannot tell you your real generation
speed -- for that, `--real` uses the actual model on your machine and
prints a real RTF (e.g. RTF 2.0 means a 10-minute script takes ~20 minutes
to render).

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
