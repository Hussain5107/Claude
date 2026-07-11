"""Wraps Chatterbox Multilingual (MIT licensed) as the TTS engine.

Loads once as a process-wide singleton (model load is expensive). Cloning a
voice computes conditioning ("speaker embedding") from a reference clip and
saves it to disk via Chatterbox's own Conditionals.save/load, so generation
later doesn't need to touch the original audio file again.
"""

import torch
from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals

_model: ChatterboxMultilingualTTS | None = None


def get_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_model() -> ChatterboxMultilingualTTS:
    global _model
    if _model is None:
        device = get_device()
        _model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    return _model


def get_supported_languages() -> dict:
    return ChatterboxMultilingualTTS.get_supported_languages()


def extract_and_save_embedding(audio_path: str, embedding_path: str, exaggeration: float = 0.5) -> None:
    model = get_model()
    model.prepare_conditionals(audio_path, exaggeration=exaggeration)
    model.conds.save(embedding_path)


def generate_with_embedding(
    text: str,
    embedding_path: str,
    language_id: str = "en",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
) -> tuple[torch.Tensor, int]:
    model = get_model()
    model.conds = Conditionals.load(embedding_path, map_location=model.device).to(model.device)
    wav = model.generate(
        text,
        language_id=language_id,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
    )
    return wav.squeeze(0), model.sr
