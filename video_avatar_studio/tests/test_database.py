from backend import database


def test_insert_and_get_avatar():
    avatar_id = database.insert_avatar("me", "/tmp/me.jpg")
    avatar = database.get_avatar(avatar_id)
    assert avatar["name"] == "me"
    assert avatar["image_path"] == "/tmp/me.jpg"


def test_get_avatar_by_name():
    database.insert_avatar("me", "/tmp/me.jpg")
    avatar = database.get_avatar_by_name("me")
    assert avatar is not None
    assert avatar["name"] == "me"


def test_get_missing_avatar_returns_none():
    assert database.get_avatar(999) is None
    assert database.get_avatar_by_name("nobody") is None


def test_list_avatars_orders_newest_first():
    database.insert_avatar("first", "/tmp/a.jpg")
    database.insert_avatar("second", "/tmp/b.jpg")
    names = [a["name"] for a in database.list_avatars()]
    assert names == ["second", "first"]


def test_delete_avatar():
    avatar_id = database.insert_avatar("me", "/tmp/me.jpg")
    database.delete_avatar(avatar_id)
    assert database.get_avatar(avatar_id) is None
