class VideoAvatarError(Exception):
    """Base class for domain errors, mapped to HTTP status codes in main.py."""


class InvalidAvatarNameError(VideoAvatarError):
    pass


class InvalidImageError(VideoAvatarError):
    pass


class InvalidScriptError(VideoAvatarError):
    pass


class AvatarAlreadyExistsError(VideoAvatarError):
    pass


class AvatarNotFoundError(VideoAvatarError):
    pass


class JobNotFoundError(VideoAvatarError):
    pass


class ZahraUnavailableError(VideoAvatarError):
    """The local voice-cloning backend (Zahra Studio) isn't reachable."""


class ZahraVoiceError(VideoAvatarError):
    """Zahra Studio rejected the request or the voice_id doesn't exist there."""


class RenderConfigError(VideoAvatarError):
    """Missing/invalid Replicate configuration (e.g. no API token)."""


class RenderFailedError(VideoAvatarError):
    """The talking-head render backend returned a failure or timed out."""
