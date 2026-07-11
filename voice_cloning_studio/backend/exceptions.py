"""Domain-specific exceptions, mapped to HTTP responses in main.py."""


class VoiceStudioError(Exception):
    """Base class for expected, user-facing errors."""


class InvalidVoiceNameError(VoiceStudioError):
    pass


class VoiceAlreadyExistsError(VoiceStudioError):
    pass


class VoiceNotFoundError(VoiceStudioError):
    pass


class InvalidAudioError(VoiceStudioError):
    pass


class InvalidTextError(VoiceStudioError):
    pass


class JobNotFoundError(VoiceStudioError):
    pass


class VoiceProcessingError(VoiceStudioError):
    """Wraps an underlying model/library failure with a clearer message."""

    def __init__(self, cause: Exception):
        self.cause = cause
        super().__init__(f"{type(cause).__name__}: {cause}" if str(cause) else type(cause).__name__)
