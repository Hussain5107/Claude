"""Talking-head video rendering via hosted models on Replicate.

Photorealistic single-image-to-talking-video generation (what HeyGen/Synthesia
do internally) needs a GPU and several GB of model weights -- not something
this tool runs locally. Instead we rent the GPU per-render through Replicate,
which hosts open-source models that do the same job:

- SadTalker: one photo + audio in, video out, with natural head motion.
  Cheapest/fastest, good default for a talking-head avatar from a still photo.
- MuseTalk: higher-fidelity lip-sync, real-time-capable model. Costs a bit
  more per run; better if SadTalker's motion looks too stiff for your face.

Replicate model schemas occasionally change parameter names. MODEL_BACKENDS
below is the single place that maps our (image, audio) call onto each
model's actual input fields -- if a render starts failing with a "no such
input" style error from Replicate, check the model's API tab at
https://replicate.com/<owner>/<name> and update the entry here.
"""

import time
from pathlib import Path
from typing import BinaryIO

import replicate
import requests

from .config import settings
from .exceptions import RenderConfigError, RenderFailedError
from .logging_config import get_logger

logger = get_logger(__name__)


def _sadtalker_input(image_file: BinaryIO, audio_file: BinaryIO) -> dict:
    return {
        "source_image": image_file,
        "driven_audio": audio_file,
        "still": True,
        "preprocess": "full",
        "use_enhancer": True,
    }


def _musetalk_input(image_file: BinaryIO, audio_file: BinaryIO) -> dict:
    return {
        "image": image_file,
        "audio": audio_file,
    }


MODEL_BACKENDS = {
    "sadtalker": {
        "ref": "cjwbw/sadtalker",
        "build_input": _sadtalker_input,
    },
    "musetalk": {
        "ref": "douwantech/musetalk",
        "build_input": _musetalk_input,
    },
}


def _extract_video_url(output) -> str:
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        return _extract_video_url(output[0])
    if isinstance(output, dict):
        for key in ("video", "output", "url"):
            if key in output:
                return _extract_video_url(output[key])
    if hasattr(output, "url"):
        url = output.url
        return url() if callable(url) else url
    raise RenderFailedError(f"Could not find a video URL in render output: {output!r}")


def render_talking_head(image_path: Path, audio_path: Path, out_path: Path, backend: str | None = None) -> Path:
    """Animates ``image_path`` speaking ``audio_path`` and saves the result
    (mp4) to ``out_path``. Blocks until the render finishes or times out."""
    backend = backend or settings.render_backend
    if backend not in MODEL_BACKENDS:
        raise RenderConfigError(
            f"Unknown render backend '{backend}'. Choices: {', '.join(MODEL_BACKENDS)}"
        )
    if not settings.replicate_api_token:
        raise RenderConfigError(
            "REPLICATE_API_TOKEN is not set. Get one at https://replicate.com/account/api-tokens "
            "and put it in .env."
        )

    client = replicate.Client(api_token=settings.replicate_api_token)
    model_ref = MODEL_BACKENDS[backend]["ref"]
    build_input = MODEL_BACKENDS[backend]["build_input"]

    model = client.models.get(model_ref)
    with open(image_path, "rb") as image_file, open(audio_path, "rb") as audio_file:
        prediction = client.predictions.create(
            version=model.latest_version,
            input=build_input(image_file, audio_file),
        )

    logger.info("Render started: backend=%s prediction=%s", backend, prediction.id)
    start = time.time()
    while prediction.status not in ("succeeded", "failed", "canceled"):
        if time.time() - start > settings.render_timeout_sec:
            raise RenderFailedError(
                f"Render timed out after {settings.render_timeout_sec}s (backend={backend}, "
                f"prediction={prediction.id})"
            )
        time.sleep(settings.render_poll_interval_sec)
        prediction.reload()

    if prediction.status != "succeeded":
        raise RenderFailedError(f"Render failed (backend={backend}): {prediction.error}")

    video_url = _extract_video_url(prediction.output)
    resp = requests.get(video_url, stream=True, timeout=60)
    resp.raise_for_status()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)

    logger.info("Render saved to %s", out_path)
    return out_path
