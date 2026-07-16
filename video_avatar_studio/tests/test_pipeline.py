from pathlib import Path
from unittest.mock import patch

import pytest

from backend import database, pipeline
from backend.exceptions import AvatarNotFoundError


def test_generate_video_raises_when_avatar_missing():
    with pytest.raises(AvatarNotFoundError):
        pipeline.generate_video("script", avatar_id=999, voice_id=1)


def test_generate_video_calls_narration_then_render(tmp_path):
    avatar_id = database.insert_avatar("me", str(tmp_path / "me.jpg"))
    stages = []

    def fake_narration(text, voice_id, out_path):
        assert text == "hello"
        assert voice_id == 1
        out_path.write_bytes(b"wav")
        return out_path

    def fake_render(image_path, audio_path, out_path, backend):
        assert str(image_path) == str(tmp_path / "me.jpg")
        assert audio_path.read_bytes() == b"wav"
        out_path.write_bytes(b"mp4")
        return out_path

    with patch("backend.pipeline.zahra_client.generate_narration", side_effect=fake_narration), \
         patch("backend.pipeline.render_client.render_talking_head", side_effect=fake_render):
        result = pipeline.generate_video(
            "hello", avatar_id, voice_id=1, on_stage=stages.append
        )

    assert result.read_bytes() == b"mp4"
    assert stages == ["narrating", "rendering"]
