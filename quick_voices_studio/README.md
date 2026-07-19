# Quick Voices Studio

A lightweight sibling to **Zahra Studio** (the voice-cloning app). This one has
**no cloning** -- you pick from a set of fixed, ready-made voices and generate
speech immediately. No reference audio, no multi-GB model, no waiting.

Use this when you don't need your own cloned voice for a particular script --
drafts, quick previews, or narration where any natural-sounding voice will do.
Use Zahra Studio when you specifically want your own voice.

## Why it's faster

Zahra Studio's Chatterbox model is several GB and has to condition on your
reference voice clip every time. This app uses [Piper](https://github.com/OHF-Voice/piper1-gpl),
a small (tens of MB per voice), CPU-fast, offline TTS engine with a fixed set
of pre-trained speakers. No cloning step means less compute per request, and
each voice model is small enough that memory pressure isn't a concern the way
it can be with Chatterbox on a 16GB machine.

## Setup (Windows)

1. Install Python 3.12 if you don't already have it (same as Zahra Studio).
2. Double-click `start_backend.bat`. First run creates a venv and installs
   dependencies, then starts the backend on `http://localhost:8100`.
3. In a separate window, double-click `start_frontend.bat`. It opens the
   Gradio UI, usually at `http://127.0.0.1:7861`.
4. Pick a language to filter the list (optional), pick a voice, paste your
   script, hit Generate.

The first time you use a given voice, the backend downloads its model files
(one time, from Hugging Face, typically 20-80MB) into `voices/`. After that,
it's fully offline, just like Zahra Studio.

Both apps can run at the same time -- they use different ports (Zahra Studio:
8000/7860, Quick Voices: 8100/7861) specifically so they don't collide.

## Languages and voices

`backend/voice_catalog.py` ships **61 voices across 32 languages**, every
one checked against Piper's real, current voice list (not guessed) --
including Arabic, Bengali, Chinese (Mandarin), Czech, Danish, Dutch, Farsi,
Finnish, French, Georgian, German, Greek, Hindi, Hungarian, Icelandic,
Indonesian, Italian, Nepali, Norwegian, Polish, Portuguese (Brazil and
Portugal), Romanian, Russian, Slovak, Slovenian, Spanish (Spain, Mexico and
Argentina), Swahili, Swedish, Telugu, Turkish, **Urdu**, Vietnamese, and
Welsh, alongside several English (US/UK) voices.

**Urdu is supported here** (`ur_PK-fasih-medium`, `ur_PK-aegis_female-medium`)
even though the main Zahra Studio app's Chatterbox engine can't clone it --
Piper has real Urdu voices, Chatterbox doesn't. Pashto still isn't available
in either app; Piper has no Pashto voice at all.

Piper's full catalog is bigger than this curated list. To see everything
available:

```
pip install piper-tts
python -m piper.download_voices
```

That prints every voice code (e.g. `en_US-lessac-medium`) straight from
Hugging Face. Pick any code you like the sound of, add a `VoiceInfo` entry
for it in `voice_catalog.py`, and it'll show up in the dropdown -- it
downloads automatically the first time it's used.

## What this app does NOT do

- No voice cloning -- voices are fixed, pre-trained speakers, not you
- No mixed-language tags within one script (pick one voice/language per
  generation) -- Zahra Studio has that for cloned voices
- No captions/SRT export (not needed for quick drafts; can be added later
  if useful)

## Project structure

```
quick_voices_studio/
  backend/
    config.py         Settings (env-var driven, see .env.example)
    voice_catalog.py   The list of available fixed voices
    tts_engine.py      Loads/caches Piper voices, runs synthesis
    audio_utils.py      Text chunking, long-form generation, WAV writing
    jobs.py            Background job tracking (progress polling)
    main.py            FastAPI app
  frontend/
    app.py             Gradio UI
  voices/              Downloaded voice models (gitignored)
  output/              Generated audio (gitignored)
```

## Running tests

```
pip install -r requirements-dev.txt
pytest
```

Tests mock Piper's model loading/synthesis (so they run without downloading
any voice files) but exercise the real chunking and WAV-writing logic.
