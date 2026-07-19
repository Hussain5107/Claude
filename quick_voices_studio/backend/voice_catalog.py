"""Curated list of ready-made Piper voices (no cloning -- fixed, pre-trained voices).

Piper voice codes follow <lang>_<REGION>-<name>-<quality> and are hosted at
https://huggingface.co/rhasspy/piper-voices. Every code below was checked
against the real, current voice list (rhasspy/piper-samples' voices.json) --
none of these are guessed. Urdu is included (ur_PK) since Piper does support
it; Pashto is not in this list because Piper has no Pashto voice at all
(same gap as Chatterbox in the main Zahra Studio app).

This is a curated subset (single-speaker voices, medium quality or better),
not the full catalog. Run `python -m piper.download_voices` with no
arguments (after `pip install piper-tts`) to print everything available,
then add any code you want below.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class VoiceInfo:
    code: str  # e.g. "en_US-lessac-medium"
    label: str  # shown in the UI
    language: str  # BCP-47-ish tag, e.g. "en", "fr"
    language_label: str


CATALOG: list[VoiceInfo] = [
    VoiceInfo("ar_JO-kareem-medium", "Kareem", "ar", "Arabic (Jordan)"),
    VoiceInfo("bg_BG-dimitar-medium", "Dimitar", "bg", "Bulgarian"),
    VoiceInfo("bn_BD-google-medium", "Bengali (Google)", "bn", "Bengali"),
    VoiceInfo("ca_ES-upc_ona-medium", "Ona (UPC)", "ca", "Catalan"),
    VoiceInfo("cs_CZ-jirka-medium", "Jirka", "cs", "Czech"),
    VoiceInfo("cy_GB-gwryw_gogleddol-medium", "Gwryw Gogleddol", "cy", "Welsh"),
    VoiceInfo("da_DK-talesyntese-medium", "Talesyntese", "da", "Danish"),
    VoiceInfo("de_DE-thorsten-high", "Thorsten (high quality)", "de", "German"),
    VoiceInfo("el_GR-joy-medium", "Joy", "el", "Greek"),
    VoiceInfo("en_GB-alan-medium", "Alan", "en", "English (UK)"),
    VoiceInfo("en_GB-alba-medium", "Alba", "en", "English (UK)"),
    VoiceInfo("en_GB-jenny_dioco-medium", "Jenny", "en", "English (UK)"),
    VoiceInfo("en_GB-northern_english_male-medium", "Northern English Male", "en", "English (UK)"),
    VoiceInfo("en_US-lessac-high", "Lessac (high quality)", "en", "English (US)"),
    VoiceInfo("en_US-amy-medium", "Amy", "en", "English (US)"),
    VoiceInfo("en_US-ryan-high", "Ryan (high quality)", "en", "English (US)"),
    VoiceInfo("en_US-hfc_female-medium", "HFC Female", "en", "English (US)"),
    VoiceInfo("en_US-kristin-medium", "Kristin", "en", "English (US)"),
    VoiceInfo("en_US-joe-medium", "Joe", "en", "English (US)"),
    VoiceInfo("en_US-john-medium", "John", "en", "English (US)"),
    VoiceInfo("en_US-bryce-medium", "Bryce", "en", "English (US)"),
    VoiceInfo("es_ES-davefx-medium", "Davefx", "es", "Spanish (Spain)"),
    VoiceInfo("es_MX-claude-high", "Claude (high quality)", "es", "Spanish (Mexico)"),
    VoiceInfo("es_MX-ald-medium", "Ald", "es", "Spanish (Mexico)"),
    VoiceInfo("es_AR-daniela-high", "Daniela (high quality)", "es", "Spanish (Argentina)"),
    VoiceInfo("eu_ES-antton-medium", "Antton", "eu", "Basque"),
    VoiceInfo("fa_IR-amir-medium", "Amir", "fa", "Persian (Farsi)"),
    VoiceInfo("fi_FI-harri-medium", "Harri", "fi", "Finnish"),
    VoiceInfo("fr_FR-siwis-medium", "Siwis", "fr", "French"),
    VoiceInfo("fr_FR-tom-medium", "Tom", "fr", "French"),
    VoiceInfo("hi_IN-pratham-medium", "Pratham", "hi", "Hindi"),
    VoiceInfo("hi_IN-priyamvada-medium", "Priyamvada", "hi", "Hindi"),
    VoiceInfo("hu_HU-anna-medium", "Anna", "hu", "Hungarian"),
    VoiceInfo("id_ID-news_tts-medium", "News TTS", "id", "Indonesian"),
    VoiceInfo("is_IS-bui-medium", "Bui", "is", "Icelandic"),
    VoiceInfo("it_IT-paola-medium", "Paola", "it", "Italian"),
    VoiceInfo("ka_GE-natia-medium", "Natia", "ka", "Georgian"),
    VoiceInfo("lv_LV-aivars-medium", "Aivars", "lv", "Latvian"),
    VoiceInfo("ne_NP-chitwan-medium", "Chitwan", "ne", "Nepali"),
    VoiceInfo("nl_NL-pim-medium", "Pim", "nl", "Dutch (Netherlands)"),
    VoiceInfo("nl_BE-nathalie-medium", "Nathalie", "nl", "Dutch (Belgium)"),
    VoiceInfo("no_NO-talesyntese-medium", "Talesyntese", "no", "Norwegian"),
    VoiceInfo("pl_PL-darkman-medium", "Darkman", "pl", "Polish"),
    VoiceInfo("pl_PL-gosia-medium", "Gosia", "pl", "Polish"),
    VoiceInfo("pt_BR-faber-medium", "Faber", "pt", "Portuguese (Brazil)"),
    VoiceInfo("pt_PT-tugão-medium", "Tugao", "pt", "Portuguese (Portugal)"),
    VoiceInfo("ro_RO-mihai-medium", "Mihai", "ro", "Romanian"),
    VoiceInfo("ru_RU-irina-medium", "Irina", "ru", "Russian"),
    VoiceInfo("ru_RU-denis-medium", "Denis", "ru", "Russian"),
    VoiceInfo("sk_SK-lili-medium", "Lili", "sk", "Slovak"),
    VoiceInfo("sl_SI-artur-medium", "Artur", "sl", "Slovenian"),
    VoiceInfo("sq_AL-edon-medium", "Edon", "sq", "Albanian"),
    VoiceInfo("sv_SE-nst-medium", "NST", "sv", "Swedish"),
    VoiceInfo("sw_CD-lanfrica-medium", "Lanfrica", "sw", "Swahili"),
    VoiceInfo("te_IN-venkatesh-medium", "Venkatesh", "te", "Telugu"),
    VoiceInfo("tr_TR-dfki-medium", "DFKI", "tr", "Turkish"),
    VoiceInfo("uk_UA-tetiana-high", "Tetiana (high quality)", "uk", "Ukrainian"),
    VoiceInfo("ur_PK-fasih-medium", "Fasih", "ur", "Urdu"),
    VoiceInfo("ur_PK-aegis_female-medium", "Aegis (female)", "ur", "Urdu"),
    VoiceInfo("vi_VN-vais1000-medium", "Vais1000", "vi", "Vietnamese"),
    VoiceInfo("zh_CN-huayan-medium", "Huayan", "zh", "Chinese (Mandarin)"),
]


def get_voice(code: str) -> VoiceInfo | None:
    return next((v for v in CATALOG if v.code == code), None)


def list_languages() -> list[tuple[str, str]]:
    seen: dict[str, str] = {}
    for v in CATALOG:
        seen.setdefault(v.language, v.language_label)
    return list(seen.items())
