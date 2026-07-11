import os
import time

import gradio as gr
import requests

API_BASE = os.environ.get("BACKEND_URL", "http://localhost:8000")
POLL_INTERVAL_SEC = 1.5

LANGUAGES = {
    "English": "en", "Spanish": "es", "French": "fr", "German": "de",
    "Italian": "it", "Portuguese": "pt", "Polish": "pl", "Turkish": "tr",
    "Russian": "ru", "Dutch": "nl", "Chinese": "zh", "Japanese": "ja",
    "Korean": "ko", "Arabic": "ar", "Hindi": "hi", "Swedish": "sv",
    "Danish": "da", "Finnish": "fi", "Greek": "el", "Hebrew": "he",
    "Malay": "ms", "Norwegian": "no", "Swahili": "sw",
}


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


def generate_speech(text, voice_id, language_label, exaggeration, cfg_weight):
    if not text.strip():
        yield None, "Enter some text first."
        return
    if voice_id is None:
        yield None, "Pick a saved voice first."
        return

    try:
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
    except requests.RequestException as e:
        yield None, f"Could not reach backend: {e}"
        return

    if resp.status_code != 202:
        yield None, f"Error: {_error_detail(resp)}"
        return

    job_id = resp.json()["job_id"]
    yield None, "Queued..."

    while True:
        time.sleep(POLL_INTERVAL_SEC)
        try:
            status_resp = requests.get(f"{API_BASE}/jobs/{job_id}", timeout=10)
            status_resp.raise_for_status()
        except requests.RequestException as e:
            yield None, f"Lost connection to backend: {e}"
            return

        job = status_resp.json()
        if job["status"] == "failed":
            yield None, f"Error: {job['error']}"
            return
        if job["status"] == "done":
            break

        done, total = job["chunks_done"], job["chunks_total"]
        if total:
            yield None, f"Generating... chunk {done}/{total}"
        else:
            yield None, "Generating..."

    try:
        download_resp = requests.get(f"{API_BASE}/jobs/{job_id}/download", timeout=120)
        download_resp.raise_for_status()
    except requests.RequestException as e:
        yield None, f"Generation finished but download failed: {e}"
        return

    out_path = "last_generated.wav"
    with open(out_path, "wb") as f:
        f.write(download_resp.content)
    yield out_path, "Done."


with gr.Blocks(title="Voice Cloning Studio") as demo:
    gr.Markdown("# Voice Cloning Studio")

    with gr.Tab("Clone New Voice"):
        audio_in = gr.Audio(type="filepath", label="Reference voice clip (10-20s, clean, single speaker)")
        name_in = gr.Textbox(label="Voice name")
        clone_btn = gr.Button("Save voice")
        clone_status = gr.Textbox(label="Status", interactive=False)

        gr.Markdown("### Manage saved voices")
        delete_dropdown = gr.Dropdown(label="Voice to delete", choices=fetch_voice_choices())
        delete_btn = gr.Button("Delete selected voice", variant="stop")
        delete_status = gr.Textbox(label="Status", interactive=False)

    with gr.Tab("Generate Speech"):
        voice_dropdown = gr.Dropdown(label="Saved voice", choices=fetch_voice_choices())
        refresh_btn = gr.Button("Refresh voice list")
        text_in = gr.Textbox(label="Script text", lines=10)
        lang_dropdown = gr.Dropdown(label="Language", choices=list(LANGUAGES.keys()), value="English")
        exaggeration_slider = gr.Slider(0, 1, value=0.5, label="Exaggeration")
        cfg_slider = gr.Slider(0, 1, value=0.5, label="Pace / stability (cfg weight)")
        generate_btn = gr.Button("Generate speech")
        audio_out = gr.Audio(label="Result", type="filepath")
        gen_status = gr.Textbox(label="Status", interactive=False)

    clone_btn.click(clone_voice, inputs=[audio_in, name_in], outputs=[clone_status, voice_dropdown]).then(
        lambda: gr.update(choices=fetch_voice_choices()), outputs=[delete_dropdown]
    )
    delete_btn.click(delete_voice, inputs=[delete_dropdown], outputs=[delete_status, delete_dropdown]).then(
        lambda: gr.update(choices=fetch_voice_choices()), outputs=[voice_dropdown]
    )
    refresh_btn.click(lambda: gr.update(choices=fetch_voice_choices()), outputs=[voice_dropdown])
    generate_btn.click(
        generate_speech,
        inputs=[text_in, voice_dropdown, lang_dropdown, exaggeration_slider, cfg_slider],
        outputs=[audio_out, gen_status],
    )

if __name__ == "__main__":
    demo.launch()
