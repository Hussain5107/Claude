import os
import time

import gradio as gr
import requests

API_BASE = os.environ.get("BACKEND_URL", "http://localhost:8001")
POLL_INTERVAL_SEC = 3
ACTIVE_JOB_STATUSES = ("queued", "running")

STAGE_LABEL = {
    "": "Queued...",
    "narrating": "Generating narration in your cloned voice...",
    "rendering": "Rendering talking-head video (this is the slow part, a few minutes)...",
}


def _error_detail(resp: requests.Response) -> str:
    try:
        return resp.json().get("detail", resp.text)
    except ValueError:
        return resp.text


def fetch_avatar_choices():
    try:
        resp = requests.get(f"{API_BASE}/avatars", timeout=10)
        resp.raise_for_status()
        return [(a["name"], a["id"]) for a in resp.json()]
    except requests.RequestException:
        return []


def fetch_voice_choices():
    try:
        resp = requests.get(f"{API_BASE}/voices", timeout=10)
        resp.raise_for_status()
        return [(v["name"], v["id"]) for v in resp.json()]
    except requests.RequestException:
        return []


def refresh_dropdowns():
    return gr.update(choices=fetch_avatar_choices()), gr.update(choices=fetch_voice_choices())


def create_avatar(name, image_path):
    if not name or not name.strip():
        return "Enter a name for this avatar.", *refresh_dropdowns()
    if not image_path:
        return "Upload a clear, front-facing, well-lit photo.", *refresh_dropdowns()

    with open(image_path, "rb") as f:
        resp = requests.post(
            f"{API_BASE}/avatars",
            data={"name": name},
            files={"image": f},
            timeout=60,
        )
    if resp.status_code >= 400:
        return f"Error: {_error_detail(resp)}", *refresh_dropdowns()
    return f"Avatar '{name}' saved.", *refresh_dropdowns()


def generate_video(script, avatar_id, voice_id, backend):
    if not script or not script.strip():
        yield "Enter a script.", None
        return
    if avatar_id is None:
        yield "Pick an avatar (create one in the first tab if the list is empty).", None
        return
    if voice_id is None:
        yield "Pick a voice (clone one in Zahra Studio first).", None
        return

    resp = requests.post(
        f"{API_BASE}/generate-video",
        data={"script": script, "avatar_id": avatar_id, "voice_id": voice_id, "backend": backend},
        timeout=30,
    )
    if resp.status_code >= 400:
        yield f"Error: {_error_detail(resp)}", None
        return

    job_id = resp.json()["job_id"]
    while True:
        status_resp = requests.get(f"{API_BASE}/jobs/{job_id}", timeout=10)
        status_resp.raise_for_status()
        job = status_resp.json()
        if job["status"] in ACTIVE_JOB_STATUSES:
            yield STAGE_LABEL.get(job["stage"], job["stage"]), None
            time.sleep(POLL_INTERVAL_SEC)
            continue
        if job["status"] == "failed":
            yield f"Failed: {job['error']}", None
            return
        break

    download_url = f"{API_BASE}/jobs/{job_id}/download"
    out_path = f"/tmp/{job_id}.mp4"
    video_resp = requests.get(download_url, timeout=120)
    video_resp.raise_for_status()
    with open(out_path, "wb") as f:
        f.write(video_resp.content)
    yield "Done.", out_path


with gr.Blocks(title="Video Avatar Studio") as demo:
    gr.Markdown("# Video Avatar Studio")
    gr.Markdown(
        "Turn a script into a video of your cloned face speaking in your cloned voice "
        "(from Zahra Studio). Record your avatar photo once, then generate a new video "
        "from any script."
    )

    with gr.Tab("1. Create Avatar"):
        gr.Markdown(
            "Upload one clear, front-facing, well-lit photo of yourself, looking at the "
            "camera with a neutral expression. This gets reused for every video."
        )
        avatar_name = gr.Textbox(label="Avatar name")
        avatar_image = gr.Image(label="Photo", type="filepath")
        create_btn = gr.Button("Save Avatar", variant="primary")
        create_status = gr.Textbox(label="Status", interactive=False)

    with gr.Tab("2. Generate Video"):
        with gr.Row():
            avatar_dropdown = gr.Dropdown(label="Avatar", choices=fetch_avatar_choices())
            voice_dropdown = gr.Dropdown(
                label="Voice (from Zahra Studio)", choices=fetch_voice_choices()
            )
            refresh_btn = gr.Button("Refresh lists")
        backend_radio = gr.Radio(
            label="Render backend",
            choices=[("SadTalker (cheaper, natural head motion)", "sadtalker"),
                     ("MuseTalk (higher-fidelity lip-sync)", "musetalk")],
            value="sadtalker",
        )
        script_box = gr.Textbox(label="Script", lines=10, placeholder="Paste this week's script here...")
        generate_btn = gr.Button("Generate Video", variant="primary")
        generate_status = gr.Textbox(label="Status", interactive=False)
        video_output = gr.Video(label="Result")

    create_btn.click(
        create_avatar,
        inputs=[avatar_name, avatar_image],
        outputs=[create_status, avatar_dropdown, voice_dropdown],
    )
    refresh_btn.click(refresh_dropdowns, outputs=[avatar_dropdown, voice_dropdown])
    generate_btn.click(
        generate_video,
        inputs=[script_box, avatar_dropdown, voice_dropdown, backend_radio],
        outputs=[generate_status, video_output],
    )

if __name__ == "__main__":
    demo.queue().launch()
