import os
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


def _voice_label_for_id(voice_id) -> str:
    for label, vid in fetch_voice_choices():
        if vid == voice_id:
            return label
    return f"voice #{voice_id}"


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


def estimate_duration(text: str) -> str:
    words = len((text or "").split())
    minutes = words / WORDS_PER_MINUTE
    return f"{words} words -- approx {minutes:.1f} min narrated (estimate, actual pace varies)"


# --- shared job helpers, used by both Test Voice and the Generate Speech queue ---

def _submit_generation(text, voice_id, language_label, exaggeration, cfg_weight) -> str:
    resp = requests.post(
        f"{API_BASE}/generate-speech",
        data={
            "text": text,
            "voice_id": voice_id,
            "language": LANGUAGES.get(language_label, "en"),
            "exaggeration": exaggeration,
            "cfg_weight": cfg_weight,
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


# --- Test Voice tab: fast single-shot preview to tune exaggeration/pace ---

def test_voice_generate(text, voice_id, language_label, exaggeration, cfg_weight, progress=gr.Progress()):
    if not text.strip():
        yield None, "Enter some test text first."
        return
    if voice_id is None:
        yield None, "Pick a voice first."
        return

    progress(0, desc="Queuing test...")
    try:
        job_id = _submit_generation(text, voice_id, language_label, exaggeration, cfg_weight)
    except (requests.RequestException, RuntimeError) as e:
        yield None, f"Could not start test: {e}"
        return

    while True:
        time.sleep(POLL_INTERVAL_SEC)
        try:
            job = _poll_job(job_id)
        except requests.RequestException as e:
            yield None, f"Lost connection to backend: {e}"
            return

        done, total = job["chunks_done"], job["chunks_total"]
        frac = (done / total) if total else 0.0

        if job["status"] == "failed":
            progress(1.0, desc="Failed")
            yield None, f"Error: {job['error']}"
            return
        if job["status"] == "done":
            break

        progress(frac, desc=f"Generating test... {done}/{total} chunks")
        yield None, f"Generating... {done}/{total} chunks ({int(frac * 100)}%)"

    try:
        _download_job(job_id, "test_voice_preview.wav")
    except requests.RequestException as e:
        yield None, f"Generated but download failed: {e}"
        return

    progress(1.0, desc="Done")
    yield (
        "test_voice_preview.wav",
        "Done. Like it? Use 'Copy these settings' in Generate Speech. Otherwise adjust and test again.",
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


def add_to_queue(text, voice_id, language_label, exaggeration, cfg_weight, queue):
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
        "text": text,
        "words": words,
        "est_minutes": words / WORDS_PER_MINUTE,
        "status": "queued",
        "job_id": None,
        "chunks_done": 0,
        "chunks_total": 0,
        "result_path": None,
    }
    queue.append(item)
    msg = f"Added #{item['n']} ({voice_label}, {words} words, ~{item['est_minutes']:.1f} min) to the queue."
    return queue, _queue_table(queue), msg, ""


def remove_last(queue):
    queue = list(queue or [])[:-1]
    return queue, _queue_table(queue), "Removed last item."


def clear_queue():
    return [], [], "Queue cleared."


def generate_all(queue, progress=gr.Progress()):
    queue = list(queue or [])
    if not queue:
        yield queue, _queue_table(queue), "Queue is empty -- add at least one item first.", []
        return

    for item in queue:
        try:
            item["job_id"] = _submit_generation(
                item["text"], item["voice_id"], item["language_label"],
                item["exaggeration"], item["cfg_weight"],
            )
            item["status"] = "queued"
        except (requests.RequestException, RuntimeError) as e:
            item["status"] = f"failed to submit: {e}"

    yield queue, _queue_table(queue), "Submitted. Voices generate one at a time on the backend...", []

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
                    out_path = f"queue_{item['n']}_{safe_voice}.wav"
                    try:
                        _download_job(item["job_id"], out_path)
                        item["result_path"] = out_path
                        completed_files.append(out_path)
                    except requests.RequestException:
                        pass
            else:
                item["status"] = job["status"]

        finished = sum(1 for i in queue if i["status"] == "done" or str(i["status"]).startswith("failed"))
        progress(finished / len(queue), desc=f"{finished}/{len(queue)} voices finished")
        yield queue, _queue_table(queue), f"{finished}/{len(queue)} finished...", completed_files

    progress(1.0, desc="All done")
    yield queue, _queue_table(queue), "All queued jobs finished.", completed_files


def _load_logo_html() -> str:
    svg = (ASSETS_DIR / "logo.svg").read_text()
    return f"""
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
      <div style="width:280px;max-width:60vw;">{svg}</div>
      <div style="color:#666;font-size:0.95em;">
        Clone your voice once, narrate any script, unlimited, free.
      </div>
    </div>
    """


with gr.Blocks(title="Zahra Studio") as demo:
    gr.HTML(_load_logo_html())

    with gr.Tab("Clone New Voice"):
        audio_in = gr.Audio(type="filepath", label="Reference voice clip (10-20s, clean, single speaker)")
        name_in = gr.Textbox(label="Voice name")
        clone_btn = gr.Button("Save voice")
        clone_status = gr.Textbox(label="Status", interactive=False)

        gr.Markdown("### Manage saved voices")
        delete_dropdown = gr.Dropdown(label="Voice to delete", choices=fetch_voice_choices())
        delete_btn = gr.Button("Delete selected voice", variant="stop")
        delete_status = gr.Textbox(label="Status", interactive=False)

    with gr.Tab("Test Voice"):
        gr.Markdown(
            "Tune **exaggeration** and **pace/stability** on a short sentence first -- "
            "much faster than waiting on a full script to find out the settings are off."
        )
        test_voice_dropdown = gr.Dropdown(label="Voice", choices=fetch_voice_choices())
        test_lang_dropdown = gr.Dropdown(label="Language", choices=list(LANGUAGES.keys()), value="English")
        test_exaggeration = gr.Slider(0, 1, value=0.5, label="Exaggeration")
        test_cfg = gr.Slider(0, 1, value=0.5, label="Pace / stability (cfg weight)")
        test_text = gr.Textbox(label="Test sentence", value=TEST_SENTENCE, lines=3)
        test_btn = gr.Button("Generate test")
        test_audio_out = gr.Audio(label="Preview", type="filepath")
        test_status = gr.Textbox(label="Status", interactive=False)

    with gr.Tab("Generate Speech"):
        gr.Markdown(
            "Add one or more (voice, script) items to the queue, then **Generate All** -- "
            "voices are rendered one at a time on the backend (the model can only do one "
            "generation at once), but you can queue everything up front instead of "
            "waiting for each one before starting the next."
        )
        gr.Markdown(
            "Already found good settings in **Test Voice**? Use *Copy from Test Voice* below "
            "instead of resetting the sliders."
        )
        copy_from_test_btn = gr.Button("Copy voice + settings from Test Voice")

        voice_dropdown = gr.Dropdown(label="Saved voice", choices=fetch_voice_choices())
        refresh_btn = gr.Button("Refresh voice list")
        lang_dropdown = gr.Dropdown(label="Language", choices=list(LANGUAGES.keys()), value="English")
        exaggeration_slider = gr.Slider(0, 1, value=0.5, label="Exaggeration")
        cfg_slider = gr.Slider(0, 1, value=0.5, label="Pace / stability (cfg weight)")
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

        generate_all_btn = gr.Button("Generate All", variant="primary")
        results_files = gr.Files(label="Completed audio files")

    # -- Clone / delete voice wiring --
    clone_btn.click(clone_voice, inputs=[audio_in, name_in], outputs=[clone_status, voice_dropdown]).then(
        lambda: (gr.update(choices=fetch_voice_choices()), gr.update(choices=fetch_voice_choices())),
        outputs=[delete_dropdown, test_voice_dropdown],
    )
    delete_btn.click(delete_voice, inputs=[delete_dropdown], outputs=[delete_status, delete_dropdown]).then(
        lambda: (gr.update(choices=fetch_voice_choices()), gr.update(choices=fetch_voice_choices())),
        outputs=[voice_dropdown, test_voice_dropdown],
    )
    refresh_btn.click(
        lambda: (gr.update(choices=fetch_voice_choices()), gr.update(choices=fetch_voice_choices())),
        outputs=[voice_dropdown, test_voice_dropdown],
    )

    # -- Test Voice wiring --
    test_btn.click(
        test_voice_generate,
        inputs=[test_text, test_voice_dropdown, test_lang_dropdown, test_exaggeration, test_cfg],
        outputs=[test_audio_out, test_status],
    )
    copy_from_test_btn.click(
        lambda v, lg, ex, cfg: (v, lg, ex, cfg),
        inputs=[test_voice_dropdown, test_lang_dropdown, test_exaggeration, test_cfg],
        outputs=[voice_dropdown, lang_dropdown, exaggeration_slider, cfg_slider],
    )

    # -- Generate Speech queue wiring --
    text_in.change(estimate_duration, inputs=[text_in], outputs=[duration_estimate])
    add_btn.click(
        add_to_queue,
        inputs=[text_in, voice_dropdown, lang_dropdown, exaggeration_slider, cfg_slider, queue_state],
        outputs=[queue_state, queue_table, queue_status, text_in],
    )
    remove_btn.click(remove_last, inputs=[queue_state], outputs=[queue_state, queue_table, queue_status])
    clear_btn.click(clear_queue, outputs=[queue_state, queue_table, queue_status])
    generate_all_btn.click(
        generate_all,
        inputs=[queue_state],
        outputs=[queue_state, queue_table, queue_status, results_files],
    )

if __name__ == "__main__":
    demo.launch()
