# Roadmap / Future Ideas

Deferred ideas, kept here so they aren't lost between sessions. Nothing in
this file is scheduled — revisit if and when it actually becomes useful,
not on a timeline.

## Rebrand + generalize into "Zahra Video Studio" (proposed 2026-07-12)

Source: a rebrand/generalization proposal from ChatGPT, reviewed and
deliberately deferred — the project currently serves one channel with zero
published videos, so the heavier parts of the proposal would be building
architecture for problems that don't exist yet.

**Original proposal (full text, for reference):**

<details>
<summary>Click to expand ChatGPT's full proposal</summary>

- Rename all user-facing references ("Meditation Pipeline" / "Meditation
  Studio" / "meditate" CLI) to **ZAHRA VIDEO STUDIO** — web UI title/header,
  README, progress screens, generated metadata, CLI help text.
- Add a required **Video Type** selector at project creation (Guided
  Meditation, Motivational Speech, Inspirational Story, Sleep Story,
  Positive Affirmations, Breathwork, Relaxation, Nature Documentary,
  Educational, Podcast Clip, Quote Video, Custom), stored in project config
  (`"videoType": "..."`) and influencing later pipeline stages.
- **Voice dropdown** showing every voice installed on the local voice
  server (not just one hardcoded default), saved per-project.
- **Voice presets per video type** (e.g. Meditation = slower/softer/longer
  pauses; Motivational = faster/energetic/stronger emphasis; Sleep Story =
  very slow/gentle; Educational = neutral/conversational; Podcast =
  natural/expressive), user-overridable.
- Keep pipeline stage labels generic (Script → Compliance Review → Voice
  Generation → Visual Assembly → Music → Subtitles → Rendering → Metadata)
  rather than meditation-specific wording.
- Turn the home screen into a studio dashboard: Create New Project, Recent
  Projects, Pipeline Status, Output Gallery, Quick Actions, System Status.
- A "Studio Tools" section with configurable shortcut buttons (Claude Code,
  Voice Server, Remotion Preview, Local Web UI, Pexels/Pixabay dashboards,
  GitHub repo) driven by a `studio-links.json` config file rather than
  hardcoded, each opening its URL in the default browser.
- **Project templates** per content type (Meditation/Motivation/
  Story/Podcast/Educational), each defining defaults for narration voice,
  subtitle style, music volume, visual pacing, transitions, and rendering
  presets — so new content types can be added without touching the
  pipeline.
- Project config driven by settings rather than hardcoded assumptions,
  e.g. `{projectName, videoType, voice, template, aspectRatios,
  musicProfile, createdAt, pipelineVersion}`.
- Maintain backwards compatibility with existing meditation projects.

</details>

**What's actually worth building, when the time comes (trimmed scope):**

1. Rebrand UI/README/CLI text to "Zahra Video Studio" — cosmetic, low
   risk. Note in docs that this (the video pipeline) is a distinct project
   from "Zahra Studio" (the voice-cloning backend it calls), since the
   names are easy to conflate otherwise.
2. **Video Type** field on the create form + `video.config.json`
   (Guided Meditation, Motivational Speech, Sleep Story, Affirmations,
   Educational, Podcast Clip, Custom, ...).
3. **Real voice dropdown** in the web UI, populated from Zahra Studio's
   `GET /voices` — replaces the current env-var-only `ZAHRA_VOICE_NAME`.
   Genuinely useful regardless of the rest of this list.
4. **Per-video-type default presets** — a lookup table (words-per-minute,
   pause range, voice exaggeration/cfg_weight) keyed by video type, applied
   as defaults but overridable. Delivers the "Motivational is
   faster/energetic, Sleep Story is slower/gentler" behavior without a full
   templating engine.
5. **Studio Tools panel** — a `studio-links.json`-driven row of shortcut
   buttons (Voice Server, Remotion Preview, Pexels/Pixabay dashboards,
   GitHub repo) in the web UI. Cheap, real daily-workflow value.

**Deliberately deferred (don't build until there's a concrete need):**

- A full **Project Templates** system with its own transitions/
  rendering-preset abstraction — the per-type preset table above covers the
  real need; a templating engine on top of it would be speculative
  architecture for content types that don't exist in this channel yet.
- A full **dashboard rebuild** (separate Recent Projects / Pipeline Status
  / System Status sections) — the existing "Past videos" gallery already
  serves this purpose at the current scale (one user, one machine, a
  handful of videos). Revisit once there's actual experience with what
  info is missing day-to-day, rather than guessing upfront.

**Trigger conditions to revisit this:** once the channel has published
several videos and there's real appetite for a second content type (not
just meditation), or once juggling voices/settings manually in `.env`
becomes a genuine daily friction point.
