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

