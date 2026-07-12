# Meditation Video Pipeline

A local, CLI-driven pipeline for producing original guided meditation videos
(narration + calming visuals + ambient music + subtitles) built on
[Remotion](https://www.remotion.dev/). Each run generates a fresh script via
Claude, synthesizes voiceover in your own cloned voice via a locally running
**Zahra Studio** instance (free, no API key — see
[Voiceover engine](#voiceover-engine-zahra-studio) below), sources varied
background footage via Pexels/Pixabay (or your own clips), mixes in ducked
ambient music, and renders finished MP4s in both 16:9 (long-form) and 9:16
(YouTube Shorts, Instagram Reels, TikTok — same aspect ratio) — plus a
YouTube metadata file ready to paste in on upload. Script and metadata
generation can also be done manually (e.g. in a separate Claude chat) instead
of calling the Anthropic API — see `--script-file` / `--metadata-file` below.

Drive it from the command line (`meditate create ...`), or run
`npm run meditate -- web` for a local browser UI that walks through the same
steps with live progress — see [Web UI](#web-ui) below.

See `PROJECT_STRUCTURE.md`-style notes below for how everything is laid out,
and the compliance notes at the bottom for why the pipeline is built this way.

## Prerequisites

- Node.js 20+
- `ffmpeg` on your `PATH` (used for audio concatenation, ducking, and looping)
  ```sh
  sudo apt-get install -y ffmpeg   # Debian/Ubuntu
  brew install ffmpeg              # macOS
  ```
- API keys:
  - **Anthropic** (script generation) — https://console.anthropic.com (paid, pay-as-you-go; text-only generation costs cents per video)
  - **Pexels** and/or **Pixabay** (stock footage, free tiers) — at least one required unless you only use your own footage
- **Zahra Studio** running locally (voiceover — see below) — free, no API key

## Voiceover engine: Zahra Studio

Voiceover uses [Zahra Studio](https://github.com/Hussain5107/Claude/tree/claude/voice-note-script-generation-ome6cm/voice_cloning_studio)
— a local voice-cloning app (FastAPI + Chatterbox, MIT-licensed, free for
commercial use) checked into the `claude/voice-note-script-generation-ome6cm`
branch of this same repo. It runs entirely on your own machine: no API key,
no per-use cost, and narration comes out in your own cloned voice.

**One-time setup:**
1. Check out that branch (or copy the `voice_cloning_studio/` folder) alongside this pipeline.
2. Follow its own README to install dependencies and clone a voice from a short reference clip you have the right to use.
3. Note the voice name you gave it.

**Every time you generate a video:**
1. Start the Zahra Studio backend: `uvicorn backend.main:app --port 8000` (or `start_backend.bat`/`.sh`) — leave it running.
2. Make sure `.env` has `ZAHRA_STUDIO_BASE_URL` (default `http://localhost:8000`) and `ZAHRA_VOICE_NAME` set to your cloned voice's name.
3. Run `meditate create` as normal — the voiceover module submits each narration segment to Zahra Studio, waits for the background job to finish, and downloads the result.

Generation is CPU-bound and proportional to script length — expect it to take real time on a machine without a GPU.

## Setup

```sh
npm install
cp .env.example .env
# then edit .env and fill in ANTHROPIC_API_KEY, ZAHRA_STUDIO_BASE_URL,
# ZAHRA_VOICE_NAME, and PEXELS_API_KEY and/or PIXABAY_API_KEY
```

Add at least one royalty-free ambient music track to `assets/music/` (`.mp3`
or `.wav`). Optionally drop your own footage/photos into
`assets/footage/` for manual copying into a specific video's
`visuals/custom/` folder later.

## Usage

```sh
npm run meditate -- create "morning gratitude meditation" --duration 900
```

Options:

| Flag | Default | Description |
| --- | --- | --- |
| `-d, --duration <seconds>` | `900` | Target total runtime (e.g. `600`, `900`, `1200`) |
| `-f, --format <both\|16x9\|9x16>` | `both` | Which aspect ratio(s) to render |
| `--music <path>` | random from `assets/music/` | Use a specific ambient track for this video |

This scaffolds `videos/<theme-slug>-<date>/`, then runs the full pipeline in
order: script → voiceover → visuals → music → subtitles → render → metadata.
The finished MP4s and `..._metadata.txt` land in that video's `out/` folder.

### Reviewing a manually-written script

If you write your own script (e.g. with a separate Claude Project) instead of
letting `create` generate one, run it through the compliance inspector first
— this is pure local text analysis, no API key or network call needed:

```sh
npm run meditate -- inspect path/to/script.txt --duration 900
```

It checks: narration pacing vs. your target duration, text overlap against
every prior script in `videos/` (the same "reused content" risk YouTube's
manual review flags), verbatim sentence repetition within the script, generic
stock-meditation opening phrases, and a curated keyword scan for
advertiser-unfriendly content (unsubstantiated medical claims, self-harm
language, engagement-manipulation phrasing, etc.). It prints `[FAIL]` /
`[WARN]` / `[INFO]` findings and exits non-zero if anything hard-fails. This
is a heuristic keyword/similarity scan, not a legal policy determination —
treat it as a first pass, not a substitute for reading YouTube's current
guidelines yourself.

To add your own footage to a specific video before rendering, drop clips or
photos into `videos/<theme-slug>-<date>/visuals/custom/` before running (or
between steps, if you're driving the pipeline manually) — custom footage is
always preferred over stock footage.

### Generating without any Anthropic API key

Both AI-generated steps can be replaced with manually-written content —
useful if you write scripts in a separate Claude chat and don't want an API
key in the loop at all:

```sh
npm run meditate -- create "morning gratitude meditation" --duration 900 \
  --script-file path/to/script.txt \
  --metadata-file path/to/metadata.json
```

- `--script-file`: plain text, paragraphs (blank line between them) become
  narration sections. Runs the compliance inspector automatically first and
  refuses to proceed on a hard `FAIL` (override with `--skip-inspection`).
- `--metadata-file`: a JSON file shaped
  `{"title", "description", "tags": [...], "chapterTitles": [...]}`.
  Chapter timestamps are still computed locally from the real segment
  durations either way — only the AI text-generation call is skipped.

Omit either flag to have that step call Claude as usual.

### Resuming after a failure

Script generation, voiceover, visuals, music, and subtitles (steps 1-6) are
each saved to disk as they finish. If something fails afterward — most
often the Remotion render step, which is the most environment-sensitive
part — you don't need to redo the slow voiceover step:

```sh
npm run meditate -- resume <slug> --metadata-file path/to/metadata.json
```

`<slug>` is the `videos/<slug>/` folder name (e.g.
`morning-gratitude-meditation-2026-07-12`). This re-reads the existing
`script.json`, `audio/mixed.wav`, and `visuals/manifest.json` already on
disk and only re-runs rendering + metadata. Theme and duration are read
back from that video's own `video.config.json` — no need to re-supply them.

## Web UI

```sh
npm run web
```

Opens a local server at `http://localhost:4300` with the same pipeline in a
browser: fill in theme/duration/format, paste a script (with a button to copy
a ready-made script-writing prompt for a separate Claude chat), run the
compliance inspector inline, paste metadata JSON (with its own copy-prompt
button), then click Generate and watch live progress — step-by-step status,
per-segment voiceover progress, and per-frame render progress — via
server-sent events. A gallery at the bottom lists every past video with
inline players and download links.

Nothing here calls Claude directly (same manual-script/metadata workflow as
the CLI) — it only replaces the terminal/copy-paste friction. It does not
reduce Zahra Studio's CPU-bound generation time.

## Project layout

```
meditation-pipeline/
├── cli/                    # the CLI tool (commands + shared lib utilities)
│   ├── index.ts            # entry point: `meditate create <theme> ...`
│   ├── commands/           # one module per pipeline stage + pipeline.ts (shared orchestrator)
│   ├── lib/                # API clients, ffmpeg wrappers, config loading
│   └── templates/          # Remotion project template copied per video
├── web/                     # local browser UI (`npm run web`), reuses cli/commands/pipeline.ts
│   ├── server.ts             # Express + SSE progress streaming
│   ├── start.ts              # entry point
│   └── public/                # vanilla HTML/CSS/JS frontend
├── shared/
│   ├── remotion-components/  # reusable Ken Burns / subtitle / intro / audio components
│   ├── branding/
│   └── config/default.config.json  # pacing, ducking, subtitle style, branding defaults
├── assets/                 # your own music/, footage/, fonts/ (reused across videos)
├── cache/stock-footage/    # tracks which stock clips have been used, to avoid recycling
├── videos/<slug>/          # ⭐ one isolated folder per video — script, audio, visuals,
│                              subtitles, its own Remotion composition, and out/
└── public/                 # gitignored staging area Remotion needs at render time
```

Each `videos/<slug>/` folder is self-contained: its own `script.json`,
`audio/`, `visuals/`, `subtitles/`, a generated `remotion/` composition, and
a `notes.md` for logging anything you had to fix manually so the next video
doesn't repeat it. The only place actual Remotion compositions live is
inside each video's own `remotion/` folder — `shared/remotion-components/`
holds only generic, reusable building blocks.

## Compliance notes (why it's built this way)

- **Unique narration every time** — the script module calls Claude fresh per
  video; nothing is templated or reused verbatim.
- **Visual variety across videos** — `cache/stock-footage/used-clips.json`
  tracks which stock clips have already been used on the channel, and
  `findFreshClips()` prefers clips that haven't been used before, so the
  channel doesn't recycle the same 3 loops.
- **Subtle Ken Burns motion** on every background clip, so nothing sits
  static.
- **A consistent branded intro card** on every video for originality and
  channel-identity signal.
- **`notes.md` per video** — a place to record anything you had to correct,
  so future runs don't repeat the same mistake.

## Configuration

Edit `shared/config/default.config.json` to change narration pacing (words
per minute, pause lengths), voiceover settings, Ken Burns zoom/pan ranges,
music ducking levels, subtitle font/color/position, and channel branding
(name, accent color, intro duration). Per-video overrides can be added to
that video's `video.config.json` under `configOverrides` (deep-merged over
the defaults).
