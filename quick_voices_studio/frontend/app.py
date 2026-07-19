import os
import time

import gradio as gr
import requests

API_BASE = os.environ.get("QV_BACKEND_URL", "http://localhost:8100")
POLL_INTERVAL_SEC = 1.5
WORDS_PER_MINUTE = 165  # Piper reads a bit faster than Chatterbox by default


def _error_detail(resp: requests.Response) -> str:
    try:
        return resp.json().get("detail", resp.text)
    except ValueError:
        return resp.text


def _progress_bar_html(percent: float, label: str = "") -> str:
    pct = max(0.0, min(100.0, percent))
    return f"""
    <div style="margin: 6px 0;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span>{label}</span><span><b>{pct:.0f}%</b></span>
      </div>
      <div style="width:100%;background:rgba(128,128,128,0.25);border-radius:8px;
                  overflow:hidden;height:16px;">
        <div style="width:{pct}%;background:#4f8cff;height:100%;transition:width 0.3s;"></div>
      </div>
    </div>
    """


def fetch_all_voices() -> list[dict]:
    try:
        resp = requests.get(f"{API_BASE}/voices", timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException:
        return []


def _language_choices_from(voices: list[dict]) -> list[tuple[str, str]]:
    labels = sorted({v["language_label"] for v in voices})
    return [("All languages", "")] + [(label, label) for label in labels]


def _voice_choices_from(voices: list[dict], language_label: str = "") -> list[tuple[str, str]]:
    if language_label:
        voices = [v for v in voices if v["language_label"] == language_label]
    return [(f"{v['label']} -- {v['language_label']}", v["code"]) for v in voices]


def fetch_language_choices() -> list[tuple[str, str]]:
    return _language_choices_from(fetch_all_voices())


def fetch_voice_choices(language_label: str = "") -> list[tuple[str, str]]:
    return _voice_choices_from(fetch_all_voices(), language_label)


def estimate_duration(text: str) -> str:
    words = len((text or "").split())
    minutes = words / WORDS_PER_MINUTE
    return f"{words} words -- approx {minutes:.1f} min narrated (estimate, actual pace varies)"


def generate(
    text,
    voice_code,
    length_scale,
    noise_scale,
    noise_w_scale,
    pitch_semitones,
    warmth_db,
    reverb_amount,
    progress=gr.Progress(),
):
    if not text.strip():
        yield None, "Enter some script text first.", _progress_bar_html(0, "Idle")
        return
    if not voice_code:
        yield None, "Pick a voice first.", _progress_bar_html(0, "Idle")
        return

    progress(0, desc="Queuing...")
    queuing_msg = "Queuing (first use of a voice downloads it, ~50-100MB, one time only)..."
    yield None, queuing_msg, _progress_bar_html(0, "Queuing")
    try:
        resp = requests.post(
            f"{API_BASE}/generate-speech",
            data={
                "text": text,
                "voice_code": voice_code,
                "length_scale": length_scale,
                "noise_scale": noise_scale,
                "noise_w_scale": noise_w_scale,
                "pitch_semitones": pitch_semitones,
                "warmth_db": warmth_db,
                "reverb_amount": reverb_amount,
            },
            timeout=30,
        )
        if resp.status_code != 202:
            raise RuntimeError(_error_detail(resp))
        job_id = resp.json()["job_id"]
    except (requests.RequestException, RuntimeError) as e:
        yield None, f"Could not start generation: {e}", _progress_bar_html(0, "Failed to start")
        return

    while True:
        time.sleep(POLL_INTERVAL_SEC)
        try:
            job_resp = requests.get(f"{API_BASE}/jobs/{job_id}", timeout=10)
            job_resp.raise_for_status()
            job = job_resp.json()
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

        progress(frac, desc=f"Generating... {done}/{total} chunks")
        yield (
            None,
            f"Generating... {done}/{total} chunks ({int(frac * 100)}%)",
            _progress_bar_html(frac * 100, f"Chunk {done}/{total}"),
        )

    out_path = "quick_voice_output.wav"
    try:
        dl = requests.get(f"{API_BASE}/jobs/{job_id}/download", timeout=120)
        dl.raise_for_status()
        with open(out_path, "wb") as f:
            f.write(dl.content)
    except requests.RequestException as e:
        yield None, f"Generated but download failed: {e}", _progress_bar_html(100, "Download failed")
        return

    progress(1.0, desc="Done")
    yield out_path, "Done.", _progress_bar_html(100, "Done")


with gr.Blocks(title="Quick Voices Studio") as demo:
    gr.Markdown(
        "# Quick Voices Studio\n"
        "Fixed, ready-made voices -- no cloning, no reference audio, no waiting on a "
        "multi-GB model. Pick a voice and generate. First use of a voice downloads it "
        "once (a small file, tens of MB); after that it's fully offline."
    )

    language_dropdown = gr.Dropdown(label="Language", choices=fetch_language_choices(), value="")
    voice_dropdown = gr.Dropdown(label="Voice", choices=fetch_voice_choices())
    refresh_btn = gr.Button("Refresh voice list", size="sm")
    text_box = gr.Textbox(label="Script", lines=10, placeholder="Paste your script here...")
    duration_label = gr.Markdown("0 words -- approx 0.0 min narrated (estimate, actual pace varies)")
    speed_slider = gr.Slider(
        label="Speed (lower = faster, higher = slower)", minimum=0.5, maximum=2.0, value=1.0, step=0.05
    )
    with gr.Accordion("Studio controls (advanced)", open=False):
        gr.Markdown(
            "These help, but Piper has a lower natural-sounding ceiling than Zahra Studio's "
            "cloned voices -- use these for polish, not a full fix."
        )
        noise_scale_slider = gr.Slider(
            label="Expressiveness (Piper's own control, free -- no extra processing time)",
            minimum=0.0, maximum=1.5, value=0.667, step=0.01,
        )
        noise_w_scale_slider = gr.Slider(
            label="Pacing variation (Piper's own control, free -- no extra processing time)",
            minimum=0.0, maximum=1.5, value=0.8, step=0.01,
        )
        pitch_slider = gr.Slider(
            label="Pitch (semitones) -- quick resample-based shift, changes voice character too",
            minimum=-6.0, maximum=6.0, value=0.0, step=0.5,
        )
        warmth_slider = gr.Slider(
            label="Warmth (negative = brighter/thinner, positive = warmer/bassier)",
            minimum=-6.0, maximum=6.0, value=0.0, step=0.5,
        )
        reverb_slider = gr.Slider(
            label="Reverb (room presence)", minimum=0.0, maximum=1.0, value=0.0, step=0.05
        )
    generate_btn = gr.Button("Generate", variant="primary")
    progress_html = gr.HTML(_progress_bar_html(0, "Idle"))
    status_box = gr.Markdown("")
    audio_out = gr.Audio(label="Result", type="filepath")

    text_box.change(estimate_duration, inputs=text_box, outputs=duration_label)
    language_dropdown.change(
        lambda lang: gr.update(choices=fetch_voice_choices(lang), value=None),
        inputs=language_dropdown,
        outputs=voice_dropdown,
    )
    def _refresh_all(lang):
        voices = fetch_all_voices()  # one backend call feeds both dropdowns
        return (
            gr.update(choices=_language_choices_from(voices)),
            gr.update(choices=_voice_choices_from(voices, lang)),
        )

    refresh_btn.click(_refresh_all, inputs=language_dropdown, outputs=[language_dropdown, voice_dropdown])
    generate_btn.click(
        generate,
        inputs=[
            text_box,
            voice_dropdown,
            speed_slider,
            noise_scale_slider,
            noise_w_scale_slider,
            pitch_slider,
            warmth_slider,
            reverb_slider,
        ],
        outputs=[audio_out, status_box, progress_html],
    )

if __name__ == "__main__":
    demo.launch(server_port=7861)
