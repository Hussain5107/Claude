"""Structured logging setup, shared by the backend and the job worker."""

import logging
import sys

from .config import settings


def configure_logging() -> None:
    root = logging.getLogger()
    if root.handlers:
        return  # already configured (e.g. re-imported under --reload)

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-8s %(name)s: %(message)s", datefmt="%H:%M:%S")
    )
    root.addHandler(handler)
    root.setLevel(level)

    # Keep noisy third-party loggers at INFO+ regardless of our own level.
    for noisy in ("httpx", "httpcore", "urllib3"):
        logging.getLogger(noisy).setLevel(max(level, logging.INFO))


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
