from backend import database


def test_init_db_creates_table():
    database.init_db()
    assert database.list_voices() == []


def test_insert_and_get_voice():
    database.init_db()
    voice_id = database.insert_voice("alice", "/x/alice.wav", "/x/alice.conds.pt")

    voice = database.get_voice(voice_id)
    assert voice["name"] == "alice"
    assert voice["audio_path"] == "/x/alice.wav"

    by_name = database.get_voice_by_name("alice")
    assert by_name["id"] == voice_id


def test_list_voices_orders_newest_first():
    database.init_db()
    database.insert_voice("first", "/x/1.wav", "/x/1.pt")
    database.insert_voice("second", "/x/2.wav", "/x/2.pt")

    names = [v["name"] for v in database.list_voices()]
    assert names == ["second", "first"]


def test_duplicate_name_rejected():
    import sqlite3

    database.init_db()
    database.insert_voice("dup", "/x/1.wav", "/x/1.pt")
    try:
        database.insert_voice("dup", "/x/2.wav", "/x/2.pt")
        raise AssertionError("expected IntegrityError")
    except sqlite3.IntegrityError:
        pass


def test_delete_voice():
    database.init_db()
    voice_id = database.insert_voice("gone", "/x/1.wav", "/x/1.pt")

    assert database.delete_voice(voice_id) is True
    assert database.get_voice(voice_id) is None
    assert database.delete_voice(voice_id) is False  # already gone
