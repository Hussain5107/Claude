# Web Content Downloader

A small local web app for saving video, audio, images, and direct-linked
files from the web, built on top of two well-established open-source
tools: [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) (video/audio, 1000+
sites including YouTube and Instagram reels) and
[`gallery-dl`](https://github.com/mikf/gallery-dl) (image galleries/posts,
including Instagram photos, Twitter, Pinterest, Reddit).

It runs **on your own machine only** — you start it, open it in your
browser at `http://127.0.0.1:5000`, paste a link, and the file downloads to
your machine. It is not deployed anywhere and does not send your data
anywhere else.

## Setup

```bash
cd web-content-downloader
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Optional but recommended: install [ffmpeg](https://ffmpeg.org/download.html)
so "highest quality video" and "audio only (MP3)" modes work — without it,
you still get the "Best (no extra tools needed)" option.

## Run

```bash
python app.py
```

Then open http://127.0.0.1:5000.

## What it can download

- **Video / audio** — paste a YouTube, Instagram reel, or any of the 1000+
  sites `yt-dlp` supports. Pick "Best" for a single-file download with no
  extra setup, or the ffmpeg-backed options for higher quality / audio-only.
- **Image gallery / photo post** — Instagram photo posts and carousels,
  Twitter/X images, Pinterest, Reddit, and other sites `gallery-dl`
  supports. Multiple images are zipped automatically.
- **Direct file link** — any URL that points straight at a file (PDF, ZIP,
  image, etc.) is streamed straight to disk.

## What it deliberately does not do

**Scribd is blocked on purpose.** Scribd documents you haven't paid for
sit behind a paywall/DRM-style viewer designed specifically to prevent
saving or printing. Building a tool to defeat that isn't "downloading a
document" in the same sense as the rest of this app — it's circumventing
an access control, which runs into both Scribd's terms of service and (in
the US) the DMCA's anti-circumvention provisions. This app refuses
`scribd.com` links outright rather than pretend to support them.

If you legitimately need a Scribd document:
- If you have a Scribd subscription, Scribd's own **Download** button
  works for documents your plan covers.
- If it's your own upload, get it from your original source file.
- If it's meant to be public domain / freely licensed, check
  [archive.org](https://archive.org) or the original publisher first.

## Using this responsibly

Downloading is easy to do; having the right to do it is the part that
depends on you. Before saving something:

- Prefer your own content, public-domain material, openly licensed
  content (Creative Commons, etc.), or content you've been given
  permission to save.
- Private, age-restricted, or login-gated content generally won't work
  here — that's intentional, not a bug to work around.
- Even when a download technically succeeds, the platform's terms of
  service still apply to *you* as the person doing the downloading —
  this tool doesn't change that.

## Notes on how it works

- Flask backend (`app.py`) exposes `/api/download`, `/api/status/<id>`,
  and `/api/file/<id>`. Downloads run in a background thread per job and
  progress is polled from the browser every ~800ms.
- Only `http://` and `https://` URLs are accepted (no `file://` or other
  schemes), and served files are always resolved back under the app's own
  `downloads/` directory, to keep the tool from being tricked into reading
  or serving arbitrary local files.
- The server binds to `127.0.0.1` only. Don't change this to `0.0.0.0` or
  put it behind a public tunnel — it accepts arbitrary URLs and shells out
  to download tools, which is a reasonable thing to trust yourself with
  locally but not something to expose to the internet.
- Downloaded files land in `downloads/<job-id>/` and are left there after
  the browser download completes — delete them (or the whole `downloads/`
  folder) whenever you want to clean up; it's gitignored.
