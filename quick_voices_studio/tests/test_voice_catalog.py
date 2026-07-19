from backend.voice_catalog import CATALOG, get_voice, list_languages


def test_get_voice_finds_known_code():
    voice = get_voice("en_US-lessac-medium")
    assert voice is not None
    assert voice.language == "en"


def test_get_voice_returns_none_for_unknown_code():
    assert get_voice("not-a-real-voice") is None


def test_list_languages_deduplicates():
    languages = list_languages()
    codes = [code for code, _label in languages]
    assert len(codes) == len(set(codes))
    assert "en" in codes


def test_catalog_codes_are_unique():
    codes = [v.code for v in CATALOG]
    assert len(codes) == len(set(codes))
