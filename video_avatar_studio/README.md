# Video Avatar Studio

Turns a script into a video of your own cloned face speaking it in your own
cloned voice — the same idea HeyGen/Synthesia sell as a subscription, built
here as a small self-hosted pipeline you run per-video instead.

Only create an avatar of yourself, or of someone who has explicitly given you
permission. Label videos made with this as AI-generated where the platform
you publish to requires it (YouTube, TikTok, etc. increasingly do, even for
your own likeness).

## How it works

```
your script (.txt)
      |
      v
Zahra Studio (voice_cloning_studio, runs locally)   -- turns the script into
      |                                                 audio in your cloned
      v                                                 voice (Chatterbox)
narration.wav
      |
      v
Replicate (rented GPU, per-render)                  -- animates your avatar
      |                                                 photo to lip-sync/
      v                                                 head-move to the audio
video.mp4
```

Photorealistic single-photo-to-talking-video generation needs a GPU and
several GB of model weights — not practical to run in a typical laptop/CI
sandbox. Rather than reimplement that, this project rents the GPU per render
through [Replicate](https://replicate.com), which hosts the same class of
open-source models HeyGen/Synthesia are built on top of:

- **[SadTalker](https://replicate.com/cjwbw/sadtalker)** (default) — one
  photo + audio in, video out, with natural head motion and blinking.
  Cheapest and fastest; good default for a talking avatar from a single
  still photo.
- **[MuseTalk](https://replicate.com/douwantech/musetalk)** — higher-fidelity
  lip-sync, at a slightly higher per-render cost. Try this if SadTalker's
  motion looks too stiff for your face.

At roughly one video a week, either backend costs a few dollars a month —
much cheaper than a HeyGen/Synthesia subscription, in exchange for lower
out-of-the-box polish and some one-time setup.

## Prerequisites

1. **Zahra Studio already set up and running**, with your voice cloned in
   it. That's the `voice_cloning_studio/` project on the
   `claude/voice-note-script-generation-ome6cm` branch:
   ```
   cd voice_cloning_studio
   uvicorn backend.main:app --port 8000
   ```
   (Or `./start_backend.sh` from that project.) Leave it running — this
   project calls it over HTTP.
2. **A Replicate account + API token.** Sign up at
   [replicate.com](https://replicate.com), create a token at
   [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens).
   Pay-as-you-go; no monthly commitment.
3. **A calibration photo of yourself** — clear, front-facing, well-lit,
   neutral expression, plain background. This is what gets animated every
   week, so a slightly-better photo now saves re-doing every future video.

## Setup

```
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: set REPLICATE_API_TOKEN, and ZAHRA_API_URL if Zahra isn't on
# the default http://localhost:8000
```

## Weekly workflow

**Once**, register your avatar photo:
```
python cli.py register --name me --image path/to/photo.jpg
```

**Every week**, generate a video from that week's script:
```
python cli.py voices                       # find your Zahra voice_id, once
python cli.py generate \
    --avatar me \
    --voice-id 1 \
    --script this_weeks_script.txt \
    --out this_weeks_video.mp4 \
    --backend sadtalker
```
The CLI prints `narrating` then `rendering` as it moves through the
pipeline; a typical run is a few minutes, most of it the Replicate render.

## Web UI (optional)

If you'd rather paste scripts into a browser than run CLI commands:
```
./start_backend.sh     # terminal 1 -- FastAPI on :8001
./start_frontend.sh    # terminal 2 -- Gradio UI, prints its URL
```
Tab 1 registers your avatar photo once; tab 2 is script-in, video-out, with
live status while it renders.

## Architecture

```
backend/
  config.py           env-driven settings (Zahra URL, Replicate token, backend choice)
  database.py          SQLite: one row per registered avatar (name -> photo)
  zahra_client.py       calls Zahra Studio's /generate-speech + job polling
  render_client.py      calls Replicate's SadTalker/MuseTalk, downloads result
  pipeline.py            orchestrates: script -> narration -> rendered video
  jobs.py                 background job manager (mirrors Zahra Studio's pattern)
  main.py                  FastAPI: avatars CRUD, /generate-video, job polling
frontend/
  gradio_app.py         two-tab UI: create avatar, generate video
cli.py                  one-shot commands, no servers needed except Zahra
tests/                  pytest suite, everything network/GPU is mocked
```

## Swapping or upgrading the render backend

Replicate model input schemas occasionally change. `MODEL_BACKENDS` in
`backend/render_client.py` is the single place mapping (image, audio) onto
each model's actual input fields — if a render starts failing with a
"no such input" style error, check the model's API tab at
`https://replicate.com/<owner>/<name>` and update the entry there. The same
dict is where you'd add a third backend (e.g. Hallo3 for longer scripts
without identity drift) if SadTalker/MuseTalk aren't cutting it.

## Costs (rough, per video)

- SadTalker: well under $1/video at typical script lengths.
- MuseTalk: a little more (~$0.20–0.50 for a few minutes of audio, billed by
  render time).
- Zahra Studio's narration step is free (runs on your own machine).

At one video/week this is a few dollars a month total — check current
pricing on each model's Replicate page, since it's usage-based and can
change.

## Limitations

- Quality is a step below HeyGen/Synthesia — visible in fine lip detail and
  head motion naturalness, especially on close inspection. Good enough for
  narrated/explainer-style content; not indistinguishable from a real
  recording.
- One photo in, one "performance style" out. If you want different framing
  or outfits, register additional avatars (`register --name me-casual`, etc.)
  from different photos.
- Long scripts (multi-minute) can show identity drift on SadTalker/MuseTalk;
  if that becomes visible, swap in a temporal-consistency-focused model
  (e.g. Hallo3) via `MODEL_BACKENDS`.
