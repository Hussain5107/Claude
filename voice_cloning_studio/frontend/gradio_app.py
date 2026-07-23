import os
import re
import time
from pathlib import Path

import gradio as gr
import requests

API_BASE = os.environ.get("BACKEND_URL", "http://localhost:8000")
POLL_INTERVAL_SEC = 1.5
WORDS_PER_MINUTE = 140
ASSETS_DIR = Path(__file__).resolve().parent / "assets"
TEST_SENTENCE = (
    "Hello, this is a quick test of my voice settings. I want to check the "
    "pace and expression before generating my full script."
)

LANGUAGES = {
    "English": "en", "Spanish": "es", "French": "fr", "German": "de",
    "Italian": "it", "Portuguese": "pt", "Polish": "pl", "Turkish": "tr",
    "Russian": "ru", "Dutch": "nl", "Chinese": "zh", "Japanese": "ja",
    "Korean": "ko", "Arabic": "ar", "Hindi": "hi", "Swedish": "sv",
    "Danish": "da", "Finnish": "fi", "Greek": "el", "Hebrew": "he",
    "Malay": "ms", "Norwegian": "no", "Swahili": "sw",
}
LANGUAGE_LABEL_BY_CODE = {code: label for label, code in LANGUAGES.items()}

ACTIVE_JOB_STATUSES = ("queued", "running")


def _error_detail(resp: requests.Response) -> str:
    try:
        return resp.json().get("detail", resp.text)
    except ValueError:
        return resp.text


def fetch_voice_choices():
    try:
        resp = requests.get(f"{API_BASE}/voices", timeout=10)
        resp.raise_for_status()
        return [(v["name"], v["id"]) for v in resp.json()]
    except requests.RequestException:
        return []


def _voice_choice_updates(n: int) -> tuple:
    """One backend fetch fanned out to n dropdowns (instead of n fetches)."""
    choices = fetch_voice_choices()
    return tuple(gr.update(choices=choices) for _ in range(n))


def _voice_label_for_id(voice_id) -> str:
    for label, vid in fetch_voice_choices():
        if vid == voice_id:
            return label
    return f"voice #{voice_id}"


def fetch_voice_defaults(voice_id):
    """Returns (exaggeration, cfg_weight, language_label) for a voice, or None if unset/unavailable."""
    if voice_id is None:
        return None
    try:
        resp = requests.get(f"{API_BASE}/voices/{voice_id}", timeout=10)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    voice = resp.json()
    if voice.get("default_exaggeration") is None:
        return None
    language_label = LANGUAGE_LABEL_BY_CODE.get(voice.get("default_language"), "English")
    return voice["default_exaggeration"], voice["default_cfg_weight"], language_label


def apply_voice_defaults(voice_id, current_exaggeration, current_cfg, current_language):
    """Dropdown .change() handler -- autofills sliders/language if this voice has saved defaults."""
    defaults = fetch_voice_defaults(voice_id)
    if defaults is None:
        return current_exaggeration, current_cfg, current_language
    exaggeration, cfg_weight, language_label = defaults
    return exaggeration, cfg_weight, language_label


def save_voice_defaults(voice_id, exaggeration, cfg_weight, language_label):
    if voice_id is None:
        return "Pick a voice first."
    try:
        resp = requests.patch(
            f"{API_BASE}/voices/{voice_id}/defaults",
            json={
                "exaggeration": exaggeration,
                "cfg_weight": cfg_weight,
                "language": LANGUAGES.get(language_label, "en"),
            },
            timeout=10,
        )
    except requests.RequestException as e:
        return f"Could not reach backend: {e}"
    if resp.status_code != 200:
        return f"Error: {_error_detail(resp)}"
    return f"Saved as default settings for {_voice_label_for_id(voice_id)}."


def clone_voice(audio_path, name):
    if not audio_path or not name.strip():
        return "Provide both an audio file and a name.", gr.update()
    try:
        with open(audio_path, "rb") as f:
            resp = requests.post(
                f"{API_BASE}/clone-voice",
                data={"name": name.strip()},
                files={"audio": f},
                timeout=600,
            )
    except requests.RequestException as e:
        return f"Could not reach backend: {e}", gr.update()

    if resp.status_code != 200:
        return f"Error: {_error_detail(resp)}", gr.update()

    return f"Voice '{name.strip()}' cloned successfully.", gr.update(choices=fetch_voice_choices())


def delete_voice(voice_id):
    if voice_id is None:
        return "Pick a voice to delete first.", gr.update()
    try:
        resp = requests.delete(f"{API_BASE}/voices/{voice_id}", timeout=30)
    except requests.RequestException as e:
        return f"Could not reach backend: {e}", gr.update()

    if resp.status_code != 200:
        return f"Error: {_error_detail(resp)}", gr.update()
    return "Voice deleted.", gr.update(choices=fetch_voice_choices(), value=None)


_LANGUAGE_TAG_PATTERN = re.compile(r"\[(\w{2})\](.*?)\[/\1\]", re.IGNORECASE | re.DOTALL)


def _progress_bar_html(percent: float, label: str = "") -> str:
    """A dedicated, always-visible progress bar -- Gradio's built-in gr.Progress()
    renders as a subtle overlay on the button that's easy to miss, so this
    gives a big percentage readout regardless of theme. The flowing-gradient
    animation (zahra-flow) is defined once in the banner's <style> block."""
    pct = max(0.0, min(100.0, percent))
    return f"""
    <div style="margin:10px 0;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <span style="font-size:12px;letter-spacing:.6px;text-transform:uppercase;
                     color:#9a8fa8;font-weight:600;">{label}</span>
        <span style="font-size:24px;font-weight:800;line-height:1;
                     background:linear-gradient(90deg,#7b4fd0,#d84f8f);
                     -webkit-background-clip:text;background-clip:text;color:transparent;">{pct:.0f}%</span>
      </div>
      <div style="width:100%;height:20px;border-radius:999px;background:rgba(123,79,208,0.14);
                  overflow:hidden;box-shadow:inset 0 1px 3px rgba(42,24,64,0.18);">
        <div style="width:{pct}%;height:100%;border-radius:999px;transition:width .4s ease;
                    background:linear-gradient(90deg,#7b4fd0,#b44fd0,#d84f8f,#e8b64c);
                    background-size:200% 100%;animation:zahra-flow 2.5s linear infinite;"></div>
      </div>
    </div>
    """


def estimate_duration(text: str) -> str:
    spoken_text = _LANGUAGE_TAG_PATTERN.sub(lambda m: m.group(2), text or "")
    words = len(spoken_text.split())
    minutes = words / WORDS_PER_MINUTE
    return f"{words} words -- approx {minutes:.1f} min narrated (estimate, actual pace varies)"


# --- shared job helpers, used by both Test Voice and the Generate Speech queue ---

def _submit_generation(text, voice_id, language_label, exaggeration, cfg_weight, temperature) -> str:
    resp = requests.post(
        f"{API_BASE}/generate-speech",
        data={
            "text": text,
            "voice_id": voice_id,
            "language": LANGUAGES.get(language_label, "en"),
            "exaggeration": exaggeration,
            "cfg_weight": cfg_weight,
            "temperature": temperature,
        },
        timeout=30,
    )
    if resp.status_code != 202:
        raise RuntimeError(_error_detail(resp))
    return resp.json()["job_id"]


def _poll_job(job_id: str) -> dict:
    resp = requests.get(f"{API_BASE}/jobs/{job_id}", timeout=10)
    resp.raise_for_status()
    return resp.json()


def _download_job(job_id: str, out_path: str) -> None:
    resp = requests.get(f"{API_BASE}/jobs/{job_id}/download", timeout=120)
    resp.raise_for_status()
    Path(out_path).write_bytes(resp.content)


def _download_captions(job_id: str, out_path: str) -> None:
    resp = requests.get(f"{API_BASE}/jobs/{job_id}/captions", timeout=30)
    resp.raise_for_status()
    Path(out_path).write_bytes(resp.content)


# --- Resume tab: recover a job that failed or was cut short (crash, closed
# window, laptop sleep) without regenerating chunks already finished ---

def fetch_resumable_jobs() -> list[dict]:
    try:
        resp = requests.get(f"{API_BASE}/jobs/resumable", timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException:
        return []


def _resumable_table(jobs: list[dict]) -> list[list]:
    rows = []
    for j in jobs:
        pct = f"{int(100 * j['chunks_done'] / j['chunks_total'])}%" if j["chunks_total"] else "-"
        started = time.strftime("%Y-%m-%d %H:%M", time.localtime(j["created_at"]))
        progress_str = f"{j['chunks_done']}/{j['chunks_total']} ({pct})"
        rows.append([j["voice_name"], progress_str, started, j["text_preview"]])
    return rows


def _resumable_choices(jobs: list[dict]) -> list[tuple[str, str]]:
    choices = []
    for j in jobs:
        preview = j["text_preview"][:50]
        label = f"{j['voice_name']} -- {j['chunks_done']}/{j['chunks_total']} chunks -- \"{preview}\""
        choices.append((label, j["job_id"]))
    return choices


def refresh_resumable_jobs():
    jobs = fetch_resumable_jobs()
    return _resumable_table(jobs), gr.update(choices=_resumable_choices(jobs), value=None)


def resume_generation(job_id, progress=gr.Progress()):
    if not job_id:
        yield None, None, "Pick a job to resume first.", _progress_bar_html(0, "Idle")
        return

    progress(0, desc="Resuming...")
    yield None, None, "Resuming...", _progress_bar_html(0, "Resuming")
    try:
        resp = requests.post(f"{API_BASE}/jobs/{job_id}/resume", timeout=30)
        if resp.status_code != 202:
            raise RuntimeError(_error_detail(resp))
    except (requests.RequestException, RuntimeError) as e:
        yield None, None, f"Could not resume: {e}", _progress_bar_html(0, "Failed to resume")
        return

    while True:
        time.sleep(POLL_INTERVAL_SEC)
        try:
            job = _poll_job(job_id)
        except requests.RequestException as e:
            yield None, None, f"Lost connection to backend: {e}", _progress_bar_html(0, "Connection lost")
            return

        done, total = job["chunks_done"], job["chunks_total"]
        frac = (done / total) if total else 0.0

        if job["status"] == "failed":
            progress(1.0, desc="Failed")
            yield None, None, f"Error: {job['error']}", _progress_bar_html(100, "Failed")
            return
        if job["status"] == "done":
            break

        progress(frac, desc=f"Resuming... {done}/{total} chunks")
        yield (
            None, None,
            f"Resuming... {done}/{total} chunks ({int(frac * 100)}%)",
            _progress_bar_html(frac * 100, f"Chunk {done}/{total}"),
        )

    audio_path = f"resumed_{job_id}.wav"
    try:
        _download_job(job_id, audio_path)
    except requests.RequestException as e:
        yield None, None, f"Generated but download failed: {e}", _progress_bar_html(100, "Download failed")
        return

    captions_path = f"resumed_{job_id}.srt"
    try:
        _download_captions(job_id, captions_path)
    except requests.RequestException:
        captions_path = None

    progress(1.0, desc="Done")
    yield (
        audio_path, captions_path,
        "Done -- the resumed job finished successfully.",
        _progress_bar_html(100, "Done"),
    )


# --- Test Voice tab: fast single-shot preview to tune exaggeration/pace ---

def test_voice_generate(
    text, voice_id, language_label, exaggeration, cfg_weight, temperature, progress=gr.Progress()
):
    if not text.strip():
        yield None, "Enter some test text first.", _progress_bar_html(0, "Idle")
        return
    if voice_id is None:
        yield None, "Pick a voice first.", _progress_bar_html(0, "Idle")
        return

    progress(0, desc="Queuing test...")
    yield None, "Queuing...", _progress_bar_html(0, "Queuing")
    try:
        job_id = _submit_generation(text, voice_id, language_label, exaggeration, cfg_weight, temperature)
    except (requests.RequestException, RuntimeError) as e:
        yield None, f"Could not start test: {e}", _progress_bar_html(0, "Failed to start")
        return

    while True:
        time.sleep(POLL_INTERVAL_SEC)
        try:
            job = _poll_job(job_id)
        except requests.RequestException as e:
            yield None, f"Lost connection to backend: {e}", _progress_bar_html(0, "Connection lost")
            return

        done, total = job["chunks_done"], job["chunks_total"]
        frac = (done / total) if total else 0.0

        if job["status"] == "failed":
            progress(1.0, desc="Failed")
            yield None, f"Error: {job['error']}", _progress_bar_html(100, "Failed")
            return
        if job["status"] == "done":
            break

        progress(frac, desc=f"Generating test... {done}/{total} chunks")
        yield (
            None,
            f"Generating... {done}/{total} chunks ({int(frac * 100)}%)",
            _progress_bar_html(frac * 100, f"Chunk {done}/{total}"),
        )

    try:
        _download_job(job_id, "test_voice_preview.wav")
    except requests.RequestException as e:
        yield None, f"Generated but download failed: {e}", _progress_bar_html(100, "Download failed")
        return

    progress(1.0, desc="Done")
    yield (
        "test_voice_preview.wav",
        "Done. Like it? Use 'Save as default' below, or 'Copy from Test Voice' in Generate Speech.",
        _progress_bar_html(100, "Done"),
    )


# --- Generate Speech tab: queue multiple (voice, script) jobs, run them as a batch ---

def _queue_table(queue: list[dict]) -> list[list]:
    rows = []
    for item in queue:
        pct = f"{int(100 * item['chunks_done'] / item['chunks_total'])}%" if item["chunks_total"] else "-"
        rows.append([
            item["n"], item["voice_label"], item["words"],
            f"{item['est_minutes']:.1f} min", item["status"], pct,
        ])
    return rows


def _renumber(queue: list[dict]) -> list[dict]:
    for i, item in enumerate(queue, start=1):
        item["n"] = i
    return queue


def add_to_queue(text, voice_id, language_label, exaggeration, cfg_weight, temperature, queue):
    queue = list(queue or [])
    if not text.strip():
        return queue, _queue_table(queue), "Enter script text first.", text
    if voice_id is None:
        return queue, _queue_table(queue), "Pick a voice first.", text

    voice_label = _voice_label_for_id(voice_id)
    words = len(text.split())
    item = {
        "n": len(queue) + 1,
        "voice_id": voice_id,
        "voice_label": voice_label,
        "language_label": language_label,
        "exaggeration": exaggeration,
        "cfg_weight": cfg_weight,
        "temperature": temperature,
        "text": text,
        "words": words,
        "est_minutes": words / WORDS_PER_MINUTE,
        "status": "queued",
        "job_id": None,
        "chunks_done": 0,
        "chunks_total": 0,
        "result_path": None,
        "captions_path": None,
    }
    queue.append(item)
    msg = f"Added #{item['n']} ({voice_label}, {words} words, ~{item['est_minutes']:.1f} min) to the queue."
    return queue, _queue_table(queue), msg, ""


def remove_last(queue):
    queue = list(queue or [])[:-1]
    return queue, _queue_table(queue), "Removed last item."


def clear_queue():
    return [], [], "Queue cleared."


def move_item(index, direction, queue):
    queue = list(queue or [])
    idx = int(index) - 1 if index is not None else -1
    other = idx + direction
    if not (0 <= idx < len(queue)) or not (0 <= other < len(queue)):
        return queue, _queue_table(queue), "Can't move that item further in that direction."
    queue[idx], queue[other] = queue[other], queue[idx]
    queue = _renumber(queue)
    return queue, _queue_table(queue), f"Moved item {index} {'up' if direction < 0 else 'down'}."


def load_item_for_editing(index, queue):
    queue = list(queue or [])
    idx = int(index) - 1 if index is not None else -1
    if not (0 <= idx < len(queue)):
        no_change = gr.update()
        return (
            queue, _queue_table(queue), "Invalid item number.",
            no_change, no_change, no_change, no_change, no_change, no_change,
        )

    item = queue.pop(idx)
    queue = _renumber(queue)
    msg = f"Loaded item #{index} into the form -- click 'Add to queue' to re-add it (it'll go to the end)."
    return (
        queue, _queue_table(queue), msg,
        item["text"], item["voice_id"], item["language_label"],
        item["exaggeration"], item["cfg_weight"], item.get("temperature", 0.8),
    )


def _batch_progress(queue: list[dict]) -> tuple[float, str]:
    """Combines overall batch progress (items finished) with the currently-running
    item's own chunk progress, so the bar moves smoothly instead of jumping in
    big steps only when a whole item finishes."""
    total = len(queue)
    finished = sum(1 for i in queue if i["status"] == "done" or str(i["status"]).startswith("failed"))
    running = next((i for i in queue if i["status"] == "running"), None)

    current_frac = 0.0
    label = f"{finished}/{total} voices finished"
    if running and running.get("chunks_total"):
        current_frac = running["chunks_done"] / running["chunks_total"]
        label = f"Item {finished + 1}/{total} -- chunk {running['chunks_done']}/{running['chunks_total']}"

    overall_pct = ((finished + current_frac) / total * 100) if total else 0.0
    return overall_pct, label


def generate_all(queue, progress=gr.Progress()):
    queue = list(queue or [])
    if not queue:
        yield (
            queue, _queue_table(queue), "Queue is empty -- add at least one item first.", [],
            _progress_bar_html(0, "Idle"),
        )
        return

    for item in queue:
        try:
            item["job_id"] = _submit_generation(
                item["text"], item["voice_id"], item["language_label"],
                item["exaggeration"], item["cfg_weight"], item.get("temperature", 0.8),
            )
            item["status"] = "queued"
        except (requests.RequestException, RuntimeError) as e:
            item["status"] = f"failed to submit: {e}"

    yield (
        queue, _queue_table(queue), "Submitted. Voices generate one at a time on the backend...", [],
        _progress_bar_html(0, "Submitted"),
    )

    completed_files: list[str] = []
    while any(item["status"] in ACTIVE_JOB_STATUSES for item in queue):
        time.sleep(POLL_INTERVAL_SEC)
        for item in queue:
            if item["status"] not in ACTIVE_JOB_STATUSES or not item["job_id"]:
                continue
            try:
                job = _poll_job(item["job_id"])
            except requests.RequestException:
                continue

            item["chunks_done"] = job["chunks_done"]
            item["chunks_total"] = job["chunks_total"]
            if job["status"] == "failed":
                item["status"] = f"failed: {job['error']}"
            elif job["status"] == "done":
                item["status"] = "done"
                if not item["result_path"]:
                    safe_voice = item["voice_label"].replace(" ", "_")
                    audio_path = f"queue_{item['n']}_{safe_voice}.wav"
                    try:
                        _download_job(item["job_id"], audio_path)
                        item["result_path"] = audio_path
                        completed_files.append(audio_path)
                    except requests.RequestException:
                        pass
                    if job.get("has_captions"):
                        captions_path = f"queue_{item['n']}_{safe_voice}.srt"
                        try:
                            _download_captions(item["job_id"], captions_path)
                            item["captions_path"] = captions_path
                            completed_files.append(captions_path)
                        except requests.RequestException:
                            pass
            else:
                item["status"] = job["status"]

        finished = sum(1 for i in queue if i["status"] == "done" or str(i["status"]).startswith("failed"))
        overall_pct, label = _batch_progress(queue)
        progress(overall_pct / 100, desc=label)
        yield (
            queue, _queue_table(queue), f"{finished}/{len(queue)} finished...", completed_files,
            _progress_bar_html(overall_pct, label),
        )

    progress(1.0, desc="All done")
    yield (
        queue, _queue_table(queue), "All queued jobs finished.", completed_files,
        _progress_bar_html(100, "All done"),
    )


def _load_logo_html() -> str:
    svg = (ASSETS_DIR / "logo.svg").read_text()
    return f"""
    <style>
      @keyframes zahra-flow {{ 0% {{background-position:0 0;}} 100% {{background-position:200% 0;}} }}
      @keyframes zahra-twinkle {{ 0%,100% {{opacity:.25;}} 50% {{opacity:1;}} }}
      @media (prefers-reduced-motion: reduce) {{
        .zahra-banner *, .zahra-banner {{ animation: none !important; }}
      }}
    </style>
    <div class="zahra-banner" style="position:relative;overflow:hidden;border-radius:18px;
         background:linear-gradient(120deg,#2a1840 0%,#4b2a72 45%,#8a3d78 78%,#b8506e 100%);
         padding:26px 32px;margin-bottom:14px;display:flex;align-items:center;gap:28px;
         flex-wrap:wrap;box-shadow:0 10px 30px rgba(42,24,64,0.35);">
      <div style="width:300px;max-width:70vw;flex-shrink:0;">{svg}</div>
      <div style="color:#f2e2c9;min-width:220px;flex:1;
                  font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;">
        <div style="font-size:1.35em;font-weight:700;letter-spacing:.3px;margin-bottom:6px;">
          Your voice. Any script. Unlimited.
        </div>
        <div style="font-size:.95em;opacity:.85;line-height:1.55;">
          Clone your voice once, then narrate anything -- 23 languages,
          mixed-language scripts, auto captions. Free, offline, yours.
        </div>
      </div>
      <span style="position:absolute;top:18px;right:26px;color:#e8b64c;font-size:20px;
                   animation:zahra-twinkle 2.8s ease-in-out infinite;">&#10022;</span>
      <span style="position:absolute;bottom:20px;right:70px;color:#e8b64c;font-size:13px;
                   animation:zahra-twinkle 3.6s ease-in-out .9s infinite;">&#10022;</span>
      <span style="position:absolute;top:44px;right:110px;color:#f2e2c9;font-size:10px;
                   animation:zahra-twinkle 3.1s ease-in-out 1.6s infinite;">&#10022;</span>
    </div>
    """


ZAHRA_CSS = """
.gradio-container { max-width: 1100px !important; margin: 0 auto !important; }
gradio-app {
  background: linear-gradient(180deg, #faf5ec 0%, #f7eef6 55%, #f2ecfa 100%) !important;
}
.dark gradio-app, gradio-app.dark {
  background: linear-gradient(180deg, #191221 0%, #221830 60%, #241a2e 100%) !important;
}
button.primary {
  background: linear-gradient(90deg, #7b4fd0, #d84f8f) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 14px rgba(123, 79, 208, 0.35) !important;
}
button.primary:hover { filter: brightness(1.08); }
.tab-nav button.selected {
  color: #7b4fd0 !important;
  font-weight: 700 !important;
  border-bottom: 3px solid #d84f8f !important;
}
"""


ZAHRA_THEME = gr.themes.Soft(
    primary_hue="purple",
    secondary_hue="rose",
    neutral_hue="stone",
    font=["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
    font_mono=["ui-monospace", "Consolas", "monospace"],
)

with gr.Blocks(title="Zahra Studio", analytics_enabled=False) as demo:
    gr.HTML(_load_logo_html())

    with gr.Tab("Clone New Voice"):
        with gr.Row():
            audio_in = gr.Audio(type="filepath", label="Reference voice clip (10-20s, clean, single speaker)")
            name_in = gr.Textbox(label="Voice name")
        clone_btn = gr.Button("Save voice", variant="primary")
        clone_status = gr.Textbox(label="Status", interactive=False)

        gr.Markdown("### Manage saved voices")
        delete_dropdown = gr.Dropdown(label="Voice to delete", choices=fetch_voice_choices())
        delete_btn = gr.Button("Delete selected voice", variant="stop")
        delete_status = gr.Textbox(label="Status", interactive=False)

    with gr.Tab("Test Voice"):
        gr.Markdown(
            "Tune **exaggeration** and **pace/stability** on a short sentence first -- "
            "much faster than waiting on a full script to find out the settings are off. "
            "Picking a voice with saved defaults auto-fills its last-saved settings."
        )
        with gr.Row():
            test_voice_dropdown = gr.Dropdown(label="Voice", choices=fetch_voice_choices())
            test_lang_dropdown = gr.Dropdown(
                label="Language", choices=list(LANGUAGES.keys()), value="English"
            )
        with gr.Row():
            test_exaggeration = gr.Slider(
                0, 2, value=0.5, label="Exaggeration (emotional intensity -- try 0.7+ for dramatic delivery)"
            )
            test_cfg = gr.Slider(0, 1, value=0.5, label="Pace / stability (cfg weight)")
        test_temperature = gr.Slider(
            0.05, 1.5, value=0.8, label="Variation (higher = more natural/varied delivery, less monotone)"
        )
        test_text = gr.Textbox(label="Test sentence", value=TEST_SENTENCE, lines=3)
        test_btn = gr.Button("Generate test", variant="primary")
        test_progress_html = gr.HTML(_progress_bar_html(0, "Idle"))
        test_audio_out = gr.Audio(label="Preview", type="filepath")
        test_status = gr.Textbox(label="Status", interactive=False)
        save_defaults_btn = gr.Button("Save these as default settings for this voice")

    with gr.Tab("Generate Speech"):
        gr.Markdown(
            "Add one or more (voice, script) items to the queue, then **Generate All** -- "
            "voices are rendered one at a time on the backend (the model can only do one "
            "generation at once), but you can queue everything up front instead of "
            "waiting for each one before starting the next. Each finished item includes "
            "an auto-generated `.srt` caption file alongside the audio."
        )
        gr.Markdown(
            "Already found good settings in **Test Voice**? Use *Copy from Test Voice* below "
            "instead of resetting the sliders. Picking a voice with saved defaults auto-fills them too."
        )
        gr.Markdown(
            "**Mixed-language scripts:** wrap a section in `[xx]...[/xx]` to speak it in a "
            "different language than the rest -- e.g. "
            "`Hello there. [fr]Bonjour tout le monde.[/fr] [es]Hola a todos.[/es]`. "
            "Untagged text uses whatever language is selected below. Only languages the model "
            "actually supports can be tagged (see the Language dropdown for the full list)."
        )
        copy_from_test_btn = gr.Button("Copy voice + settings from Test Voice")

        with gr.Row():
            voice_dropdown = gr.Dropdown(label="Saved voice", choices=fetch_voice_choices())
            lang_dropdown = gr.Dropdown(label="Language", choices=list(LANGUAGES.keys()), value="English")
        refresh_btn = gr.Button("Refresh voice list", size="sm")
        with gr.Row():
            exaggeration_slider = gr.Slider(
                0, 2, value=0.5, label="Exaggeration (emotional intensity -- try 0.7+ for dramatic delivery)"
            )
            cfg_slider = gr.Slider(0, 1, value=0.5, label="Pace / stability (cfg weight)")
        temperature_slider = gr.Slider(
            0.05, 1.5, value=0.8, label="Variation (higher = more natural/varied delivery, less monotone)"
        )
        text_in = gr.Textbox(label="Script text", lines=10)
        duration_estimate = gr.Markdown(estimate_duration(""))

        with gr.Row():
            add_btn = gr.Button("Add to queue")
            remove_btn = gr.Button("Remove last")
            clear_btn = gr.Button("Clear queue", variant="stop")

        queue_state = gr.State([])
        queue_table = gr.Dataframe(
            headers=["#", "Voice", "Words", "Est. Duration", "Status", "Progress"],
            label="Queue",
            interactive=False,
        )
        queue_status = gr.Textbox(label="Status", interactive=False)

        with gr.Row():
            edit_index = gr.Number(label="Item #", precision=0, minimum=1)
            move_up_btn = gr.Button("Move up")
            move_down_btn = gr.Button("Move down")
            load_edit_btn = gr.Button("Load for editing")

        generate_all_btn = gr.Button("Generate All", variant="primary")
        queue_progress_html = gr.HTML(_progress_bar_html(0, "Idle"))
        results_files = gr.Files(label="Completed files (audio + captions)")

    with gr.Tab("Resume"):
        gr.Markdown(
            "If a generation was interrupted -- an error, a closed terminal window, "
            "a laptop going to sleep -- the chunks it already finished are saved on disk "
            "and don't need to be redone. Check here, pick the job, and **Resume** "
            "picks up from wherever it stopped."
        )
        refresh_resumable_btn = gr.Button("Check for unfinished jobs")
        resumable_table = gr.Dataframe(
            headers=["Voice", "Progress", "Started", "Script preview"],
            label="Unfinished jobs",
            interactive=False,
        )
        resume_job_dropdown = gr.Dropdown(label="Job to resume")
        resume_btn = gr.Button("Resume", variant="primary")
        resume_progress_html = gr.HTML(_progress_bar_html(0, "Idle"))
        resume_status = gr.Textbox(label="Status", interactive=False)
        resume_audio_out = gr.Audio(label="Result", type="filepath")
        resume_captions_out = gr.File(label="Captions (.srt)")

    # -- Clone / delete voice wiring --
    clone_btn.click(clone_voice, inputs=[audio_in, name_in], outputs=[clone_status, voice_dropdown]).then(
        lambda: _voice_choice_updates(2),
        outputs=[delete_dropdown, test_voice_dropdown],
    )
    delete_btn.click(delete_voice, inputs=[delete_dropdown], outputs=[delete_status, delete_dropdown]).then(
        lambda: _voice_choice_updates(2),
        outputs=[voice_dropdown, test_voice_dropdown],
    )
    refresh_btn.click(
        lambda: _voice_choice_updates(2),
        outputs=[voice_dropdown, test_voice_dropdown],
    )

    # -- Test Voice wiring --
    test_voice_dropdown.change(
        apply_voice_defaults,
        inputs=[test_voice_dropdown, test_exaggeration, test_cfg, test_lang_dropdown],
        outputs=[test_exaggeration, test_cfg, test_lang_dropdown],
    )
    test_btn.click(
        test_voice_generate,
        inputs=[
            test_text, test_voice_dropdown, test_lang_dropdown, test_exaggeration, test_cfg, test_temperature
        ],
        outputs=[test_audio_out, test_status, test_progress_html],
    )
    save_defaults_btn.click(
        save_voice_defaults,
        inputs=[test_voice_dropdown, test_exaggeration, test_cfg, test_lang_dropdown],
        outputs=[test_status],
    )
    copy_from_test_btn.click(
        lambda v, lg, ex, cfg, temp: (v, lg, ex, cfg, temp),
        inputs=[test_voice_dropdown, test_lang_dropdown, test_exaggeration, test_cfg, test_temperature],
        outputs=[voice_dropdown, lang_dropdown, exaggeration_slider, cfg_slider, temperature_slider],
    )

    # -- Generate Speech queue wiring --
    voice_dropdown.change(
        apply_voice_defaults,
        inputs=[voice_dropdown, exaggeration_slider, cfg_slider, lang_dropdown],
        outputs=[exaggeration_slider, cfg_slider, lang_dropdown],
    )
    text_in.change(estimate_duration, inputs=[text_in], outputs=[duration_estimate])
    add_btn.click(
        add_to_queue,
        inputs=[
            text_in, voice_dropdown, lang_dropdown, exaggeration_slider, cfg_slider,
            temperature_slider, queue_state,
        ],
        outputs=[queue_state, queue_table, queue_status, text_in],
    )
    remove_btn.click(remove_last, inputs=[queue_state], outputs=[queue_state, queue_table, queue_status])
    clear_btn.click(clear_queue, outputs=[queue_state, queue_table, queue_status])
    move_up_btn.click(
        lambda idx, q: move_item(idx, -1, q),
        inputs=[edit_index, queue_state],
        outputs=[queue_state, queue_table, queue_status],
    )
    move_down_btn.click(
        lambda idx, q: move_item(idx, 1, q),
        inputs=[edit_index, queue_state],
        outputs=[queue_state, queue_table, queue_status],
    )
    load_edit_btn.click(
        load_item_for_editing,
        inputs=[edit_index, queue_state],
        outputs=[queue_state, queue_table, queue_status, text_in, voice_dropdown, lang_dropdown,
                 exaggeration_slider, cfg_slider, temperature_slider],
    )
    generate_all_btn.click(
        generate_all,
        inputs=[queue_state],
        outputs=[queue_state, queue_table, queue_status, results_files, queue_progress_html],
    )

    # -- Resume wiring --
    refresh_resumable_btn.click(
        refresh_resumable_jobs, outputs=[resumable_table, resume_job_dropdown]
    )
    resume_btn.click(
        resume_generation,
        inputs=[resume_job_dropdown],
        outputs=[resume_audio_out, resume_captions_out, resume_status, resume_progress_html],
    )

if __name__ == "__main__":
    demo.launch(theme=ZAHRA_THEME, css=ZAHRA_CSS)
