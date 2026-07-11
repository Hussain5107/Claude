# Claude
Used for Claude

## Voice notes from a script

`voice_note.py` converts a text script into a natural-sounding voice note (mp3),
using edge-tts (Microsoft's free neural "Read Aloud" voices — no API key needed).

```
pip install -r requirements.txt
python3 voice_note.py script.txt -o voice_note.mp3
```

Natural human-sounding female voice options (pass with `--voice`):
`en-US-AriaNeural` (default), `en-US-JennyNeural`, `en-US-MichelleNeural`, `en-GB-SoniaNeural`.

Tune delivery with `--rate` (e.g. `+8%`) and `--pitch` (e.g. `+2Hz`) for a more
conversational pace.

## Offline Voice Studio (long-form, for YouTube)

`offline_voice_studio.html` is a self-contained webpage for generating long (30-60+ min)
natural-sounding narration entirely offline, using the open-source Kokoro neural voice
model running in-browser via WebAssembly/WebGPU. No server, no API key, no per-use cost.

**Run it (Windows/Mac/Linux, Chrome or Edge recommended):**

```
python3 -m http.server 8000
```

then open `http://localhost:8000/offline_voice_studio.html`. Opening the file directly
(double-click / `file://`) will not work — browsers block the module/CDN imports it needs
under the `file://` origin.

**First run:** click "Load voice model" — this downloads the voice model (~100-300MB
depending on the precision setting) and needs internet access once. The browser caches it,
so every run after that works fully offline, as long as you don't clear the site's
browser data.

Paste your script, pick a voice/speed, and click "Generate voice note". Output is
exported as WAV file(s) (split into parts as it goes, so very long scripts don't blow up
memory) with players and download buttons for each part.

## Cloned Voice Studio (narrate in your own voice)

`clone_server.py` + `cloned_voice_studio.html` narrate scripts in your own cloned voice,
using [Chatterbox](https://github.com/resemble-ai/chatterbox) (Resemble AI, MIT licensed —
free for commercial use, e.g. monetized YouTube). Only use a reference clip you have the
right to clone (your own voice, or a voice you have explicit permission to use).

**Setup:**

```
pip install -r requirements-clone.txt
```

This pulls in PyTorch and the model weights (several GB on first run). A GPU is strongly
recommended — CPU works but is much slower, and for 30-60 minute scripts that difference
is hours vs. minutes.

1. Save a clean ~10-20 second solo clip of your voice as `voice_sample.mp3` in this folder
   (or point `VOICE_SAMPLE` at a different path). This file is git-ignored — it never gets
   committed.
2. Run `python3 clone_server.py`.
3. Open `http://localhost:5000`, click "Check server connection", paste your script, and
   generate. Same chunked long-form workflow as Offline Voice Studio (WAV parts, players,
   download buttons), but every chunk is synthesized in your cloned voice instead of a
   stock voice.

