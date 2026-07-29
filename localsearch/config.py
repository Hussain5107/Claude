"""Configuration: where the index lives and what gets indexed."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict, field
from pathlib import Path

# Extensions we know how to read. Anything else in the folder is skipped.
TEXT_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".rst", ".org",
    ".csv", ".tsv", ".json", ".jsonl", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".html", ".htm", ".xml",
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".c", ".h", ".cpp", ".hpp",
    ".go", ".rs", ".rb", ".php", ".sh", ".sql", ".r", ".m", ".swift", ".kt",
}
BINARY_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".epub"}
SUPPORTED_EXTENSIONS = TEXT_EXTENSIONS | BINARY_EXTENSIONS

# Directories that are never worth indexing.
DEFAULT_EXCLUDE_DIRS = {
    ".git", ".hg", ".svn", ".localsearch", "node_modules", "__pycache__",
    ".venv", "venv", "env", ".env", "dist", "build", ".next", ".cache",
    ".mypy_cache", ".pytest_cache", ".ruff_cache", ".idea", ".vscode",
    "site-packages", ".Trash", "$RECYCLE.BIN",
}

INDEX_DIRNAME = ".localsearch"
CONFIG_FILENAME = "config.json"
DB_FILENAME = "index.db"


@dataclass
class Config:
    """Per-folder settings, persisted in <folder>/.localsearch/config.json."""

    # Indexing
    max_file_mb: float = 25.0
    chunk_size: int = 1200          # characters per chunk (~300 tokens)
    chunk_overlap: int = 200
    exclude_dirs: list[str] = field(default_factory=lambda: sorted(DEFAULT_EXCLUDE_DIRS))
    exclude_globs: list[str] = field(default_factory=list)
    follow_symlinks: bool = False

    # Semantic search (optional — requires sentence-transformers + numpy)
    embeddings: bool = False
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Answering
    backend: str = "auto"            # auto | ollama | anthropic | none
    ollama_model: str = "llama3.1:8b"
    ollama_host: str = "http://localhost:11434"
    anthropic_model: str = "claude-sonnet-5"
    top_k: int = 8                   # chunks fed to the model

    @classmethod
    def load(cls, root: Path) -> "Config":
        path = config_path(root)
        if not path.exists():
            return cls()
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in data.items() if k in known})

    def save(self, root: Path) -> None:
        path = config_path(root)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            json.dump(asdict(self), fh, indent=2, sort_keys=True)
            fh.write("\n")


def index_dir(root: Path) -> Path:
    return Path(root).expanduser().resolve() / INDEX_DIRNAME


def config_path(root: Path) -> Path:
    return index_dir(root) / CONFIG_FILENAME


def db_path(root: Path) -> Path:
    return index_dir(root) / DB_FILENAME


def resolve_root(folder: str | os.PathLike[str] | None) -> Path:
    """Resolve the folder to search, falling back to $LOCALSEARCH_FOLDER or cwd."""
    if folder is None:
        folder = os.environ.get("LOCALSEARCH_FOLDER") or "."
    root = Path(folder).expanduser().resolve()
    if not root.is_dir():
        raise NotADirectoryError(f"Not a folder: {root}")
    return root
