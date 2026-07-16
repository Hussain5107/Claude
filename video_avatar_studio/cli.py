#!/usr/bin/env python3
"""One-shot CLI for the weekly workflow: no servers to run.

Usage:
    # once, to register your avatar photo
    python cli.py register --name me --image photo.jpg

    # list voices already cloned in Zahra Studio (must be running)
    python cli.py voices

    # every week
    python cli.py generate --avatar me --voice-id 1 --script script.txt --out video.mp4
"""

import argparse
import sys
from pathlib import Path

from backend import database, pipeline, zahra_client
from backend.config import settings
from backend.exceptions import VideoAvatarError


def cmd_register(args: argparse.Namespace) -> None:
    database.init_db()
    image_path = Path(args.image).resolve()
    if not image_path.exists():
        sys.exit(f"Image not found: {image_path}")
    if database.get_avatar_by_name(args.name):
        sys.exit(f"Avatar '{args.name}' already exists. Delete it first if you want to replace the photo.")

    dest = settings.avatars_dir / f"{args.name}{image_path.suffix.lower()}"
    dest.write_bytes(image_path.read_bytes())
    avatar_id = database.insert_avatar(args.name, str(dest))
    print(f"Registered avatar '{args.name}' as id={avatar_id} ({dest})")


def cmd_list_avatars(_args: argparse.Namespace) -> None:
    database.init_db()
    for a in database.list_avatars():
        print(f"{a['id']}: {a['name']} ({a['image_path']})")


def cmd_voices(_args: argparse.Namespace) -> None:
    for v in zahra_client.list_voices():
        print(f"{v['id']}: {v['name']}")


def cmd_generate(args: argparse.Namespace) -> None:
    database.init_db()
    avatar = database.get_avatar_by_name(args.avatar) if not args.avatar.isdigit() else database.get_avatar(int(args.avatar))
    if not avatar:
        sys.exit(f"Avatar '{args.avatar}' not found. Run 'register' first, or 'list-avatars' to see what exists.")

    script_text = Path(args.script).read_text(encoding="utf-8")
    print(f"Generating video for avatar '{avatar['name']}' (backend={args.backend})...")

    def on_stage(stage: str) -> None:
        print(f"  -> {stage}")

    video_path = pipeline.generate_video(
        script_text, avatar["id"], args.voice_id, backend=args.backend, on_stage=on_stage
    )
    out_path = Path(args.out).resolve()
    out_path.write_bytes(video_path.read_bytes())
    video_path.unlink(missing_ok=True)
    print(f"Saved: {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_register = sub.add_parser("register", help="Register your avatar photo (once)")
    p_register.add_argument("--name", required=True)
    p_register.add_argument("--image", required=True)
    p_register.set_defaults(func=cmd_register)

    p_list = sub.add_parser("list-avatars", help="List registered avatars")
    p_list.set_defaults(func=cmd_list_avatars)

    p_voices = sub.add_parser("voices", help="List voices available in Zahra Studio")
    p_voices.set_defaults(func=cmd_voices)

    p_generate = sub.add_parser("generate", help="Generate this week's video")
    p_generate.add_argument("--avatar", required=True, help="Avatar name or id")
    p_generate.add_argument("--voice-id", required=True, type=int, help="Zahra Studio voice id (see 'voices')")
    p_generate.add_argument("--script", required=True, help="Path to a .txt file with the script")
    p_generate.add_argument("--out", default="video.mp4")
    p_generate.add_argument("--backend", choices=["sadtalker", "musetalk"], default=None)
    p_generate.set_defaults(func=cmd_generate)

    args = parser.parse_args()
    try:
        args.func(args)
    except VideoAvatarError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    main()
