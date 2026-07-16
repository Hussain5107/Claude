from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend import render_client
from backend.config import settings
from backend.exceptions import RenderConfigError, RenderFailedError


def test_extract_video_url_from_plain_string():
    assert render_client._extract_video_url("http://x/video.mp4") == "http://x/video.mp4"


def test_extract_video_url_from_list():
    assert render_client._extract_video_url(["http://x/video.mp4"]) == "http://x/video.mp4"


def test_extract_video_url_from_dict():
    assert render_client._extract_video_url({"video": "http://x/video.mp4"}) == "http://x/video.mp4"


def test_extract_video_url_raises_when_unrecognized():
    with pytest.raises(RenderFailedError):
        render_client._extract_video_url(12345)


def test_unknown_backend_raises_config_error(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "replicate_api_token", "token")
    with pytest.raises(RenderConfigError, match="Unknown render backend"):
        render_client.render_talking_head(tmp_path / "a.jpg", tmp_path / "a.wav", tmp_path / "out.mp4", backend="nope")


def test_missing_api_token_raises_config_error(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "replicate_api_token", "")
    with pytest.raises(RenderConfigError, match="REPLICATE_API_TOKEN"):
        render_client.render_talking_head(tmp_path / "a.jpg", tmp_path / "a.wav", tmp_path / "out.mp4", backend="sadtalker")


def test_render_talking_head_happy_path(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "replicate_api_token", "token")
    image_path = tmp_path / "avatar.jpg"
    audio_path = tmp_path / "narration.wav"
    image_path.write_bytes(b"img")
    audio_path.write_bytes(b"aud")
    out_path = tmp_path / "out.mp4"

    mock_prediction = MagicMock(status="succeeded", output="http://example.com/video.mp4")
    mock_model = MagicMock(latest_version="v1")
    mock_client = MagicMock()
    mock_client.models.get.return_value = mock_model
    mock_client.predictions.create.return_value = mock_prediction

    mock_download = MagicMock(status_code=200)
    mock_download.iter_content.return_value = [b"VIDEODATA"]
    mock_download.raise_for_status = MagicMock()

    with patch("backend.render_client.replicate.Client", return_value=mock_client), \
         patch("backend.render_client.requests.get", return_value=mock_download):
        result = render_client.render_talking_head(image_path, audio_path, out_path, backend="sadtalker")

    assert result == out_path
    assert out_path.read_bytes() == b"VIDEODATA"
    mock_client.predictions.create.assert_called_once()


def test_render_talking_head_raises_on_failed_prediction(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "replicate_api_token", "token")
    image_path = tmp_path / "avatar.jpg"
    audio_path = tmp_path / "narration.wav"
    image_path.write_bytes(b"img")
    audio_path.write_bytes(b"aud")

    mock_prediction = MagicMock(status="failed", error="model error")
    mock_model = MagicMock(latest_version="v1")
    mock_client = MagicMock()
    mock_client.models.get.return_value = mock_model
    mock_client.predictions.create.return_value = mock_prediction

    with patch("backend.render_client.replicate.Client", return_value=mock_client):
        with pytest.raises(RenderFailedError, match="model error"):
            render_client.render_talking_head(image_path, audio_path, tmp_path / "out.mp4", backend="sadtalker")
