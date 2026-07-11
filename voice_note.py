#!/usr/bin/env python3
"""Convert a text script into a natural-sounding voice note (mp3).

Uses edge-tts (Microsoft Edge's neural "Read Aloud" voices) by default —
free, no API key required. Natural human-like female voices include:
  en-US-AriaNeural, en-US-JennyNeural, en-US-MichelleNeural, en-GB-SoniaNeural

Usage:
  python3 voice_note.py script.txt -o voice_note.mp3
  python3 voice_note.py script.txt -o voice_note.mp3 --voice en-US-JennyNeural --rate +5% --pitch +2Hz
  echo "Hello there" | python3 voice_note.py -o voice_note.mp3
"""

import argparse
import asyncio
import sys

import edge_tts

DEFAULT_VOICE = "en-US-AriaNeural"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "script", nargs="?", help="Path to a text file with the script. Reads stdin if omitted."
    )
    parser.add_argument("-o", "--output", default="voice_note.mp3", help="Output mp3 path.")
    parser.add_argument(
        "--voice", default=DEFAULT_VOICE, help=f"edge-tts voice name (default: {DEFAULT_VOICE})."
    )
    parser.add_argument("--rate", default="+0%", help="Speaking rate adjustment, e.g. +8%%.")
    parser.add_argument("--pitch", default="+0Hz", help="Pitch adjustment, e.g. +2Hz.")
    return parser.parse_args()


async def synthesize(text: str, voice: str, rate: str, pitch: str, output: str) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(output)


def main() -> None:
    args = parse_args()
    text = open(args.script, encoding="utf-8").read() if args.script else sys.stdin.read()
    text = text.strip()
    if not text:
        sys.exit("No script text provided.")

    asyncio.run(synthesize(text, args.voice, args.rate, args.pitch, args.output))
    print(f"Saved voice note to {args.output}")


if __name__ == "__main__":
    main()
