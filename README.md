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

