"""Curated list of ready-made Piper voices (no cloning -- fixed, pre-trained voices).

Piper voice codes follow <lang>_<REGION>-<name>-<quality> and are hosted at
https://huggingface.co/rhasspy/piper-voices. This list is a reasonable
starting set, not exhaustive -- run `python -m piper.download_voices` with no
arguments (after `pip install piper-tts`) to print the full, current list
straight from Hugging Face, then add any code you want below.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class VoiceInfo:
    code: str  # e.g. "en_US-lessac-medium"
    label: str  # shown in the UI
    language: str  # BCP-47-ish tag, e.g. "en", "fr"
    language_label: str


CATALOG: list[VoiceInfo] = [
    VoiceInfo("en_US-lessac-medium", "Lessac (US, neutral male)", "en", "English (US)"),
    VoiceInfo("en_US-amy-medium", "Amy (US, female)", "en", "English (US)"),
    VoiceInfo("en_US-ryan-high", "Ryan (US, male, high quality)", "en", "English (US)"),
    VoiceInfo("en_GB-alan-medium", "Alan (UK, male)", "en", "English (UK)"),
    VoiceInfo("fr_FR-siwis-medium", "Siwis (French, female)", "fr", "French"),
    VoiceInfo("es_ES-davefx-medium", "Davefx (Spanish, male)", "es", "Spanish"),
    VoiceInfo("de_DE-thorsten-medium", "Thorsten (German, male)", "de", "German"),
]


def get_voice(code: str) -> VoiceInfo | None:
    return next((v for v in CATALOG if v.code == code), None)


def list_languages() -> list[tuple[str, str]]:
    seen: dict[str, str] = {}
    for v in CATALOG:
        seen.setdefault(v.language, v.language_label)
    return list(seen.items())
