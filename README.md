# Meditation Video Pipeline

A local, CLI-driven pipeline for producing original guided meditation videos
(narration + calming visuals + ambient music + subtitles) built on
[Remotion](https://www.remotion.dev/). Each run generates a fresh script via
Claude, synthesizes voiceover in your own cloned voice via a locally running
**Zahra Studio** instance (free, no API key — see
[Voiceover engine](#voiceover-engine-zahra-studio) below), sources varied
background footage via Pexels/Pixabay (or your own clips), mixes in ducked
ambient music, and renders finished MP4s in both 16:9 (long-form) and 9:16
(Shorts) — plus a YouTube metadata file ready to paste in on upload.

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

To add your own footage to a specific video before rendering, drop clips or
photos into `videos/<theme-slug>-<date>/visuals/custom/` before running (or
between steps, if you're driving the pipeline manually) — custom footage is
always preferred over stock footage.

## Project layout

```
meditation-pipeline/
├── cli/                    # the CLI tool (commands + shared lib utilities)
│   ├── index.ts            # entry point: `meditate create <theme> ...`
│   ├── commands/           # one module per pipeline stage
│   ├── lib/                # API clients, ffmpeg wrappers, config loading
│   └── templates/          # Remotion project template copied per video
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
