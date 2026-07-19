"""Domain exceptions, mapped to HTTP status codes in main.py."""


class QuickVoicesError(Exception):
    status_code = 400


class UnknownVoiceError(QuickVoicesError):
    status_code = 404


class InvalidTextError(QuickVoicesError):
    status_code = 400


class VoiceDownloadError(QuickVoicesError):
    status_code = 502


class JobNotFoundError(QuickVoicesError):
    status_code = 404
