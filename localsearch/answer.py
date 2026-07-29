"""Turn retrieved chunks into a grounded answer.

Backends
--------
ollama    fully local — needs `ollama serve` running with a pulled model
anthropic Claude API — needs ANTHROPIC_API_KEY (retrieved text leaves the machine)
none      no model — returns the ranked excerpts only
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

from .config import Config
from .retrieve import Hit, build_context

SYSTEM_PROMPT = """You answer questions using only the excerpts from the user's \
own files that are provided below.

Rules:
- Base every claim on the excerpts. Do not use outside knowledge.
- Cite the excerpt numbers you used inline, like [1] or [2][3].
- If the excerpts do not contain the answer, say so plainly and name what is \
missing. Never invent details.
- Be concise and direct. Quote short phrases when precision matters."""

USER_TEMPLATE = """Excerpts from my files:

{context}

---

Question: {question}"""


class BackendError(Exception):
    """Raised when the selected answer backend cannot be reached or used."""


@dataclass
class Answer:
    text: str
    backend: str
    model: str
    hits: list[Hit]

    def sources(self) -> list[str]:
        seen: list[str] = []
        for hit in self.hits:
            if hit.path not in seen:
                seen.append(hit.path)
        return seen


def resolve_backend(config: Config) -> str:
    """Pick a backend, preferring the fully local one when it is reachable."""
    if config.backend != "auto":
        return config.backend
    if ollama_available(config.ollama_host):
        return "ollama"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    return "none"


def ollama_available(host: str, timeout: float = 1.5) -> bool:
    try:
        with urllib.request.urlopen(f"{host.rstrip('/')}/api/tags", timeout=timeout):
            return True
    except Exception:
        return False


def generate(question: str, hits: list[Hit], config: Config) -> Answer:
    backend = resolve_backend(config)
    if not hits:
        return Answer(
            "Nothing in the indexed folder matches that question. "
            "Try different wording, or re-run indexing if you added files recently.",
            backend,
            "-",
            hits,
        )

    context = build_context(hits)
    prompt = USER_TEMPLATE.format(context=context, question=question)

    if backend == "ollama":
        text = _ask_ollama(prompt, config)
        return Answer(text, backend, config.ollama_model, hits)
    if backend == "anthropic":
        text = _ask_anthropic(prompt, config)
        return Answer(text, backend, config.anthropic_model, hits)
    if backend == "none":
        return Answer(_excerpts_only(hits), "none", "-", hits)
    raise BackendError(f"Unknown backend: {backend!r}")


def _excerpts_only(hits: list[Hit]) -> str:
    lines = [
        "No answer model is configured, so here are the most relevant excerpts.",
        "(Run `ollama serve` with a pulled model, or set ANTHROPIC_API_KEY, "
        "to get written answers.)",
        "",
    ]
    for i, hit in enumerate(hits, start=1):
        body = " ".join(hit.text.split())
        lines.append(f"[{i}] {hit.citation}")
        lines.append(body[:600] + ("…" if len(body) > 600 else ""))
        lines.append("")
    return "\n".join(lines).rstrip()


def _ask_ollama(prompt: str, config: Config) -> str:
    payload = json.dumps({
        "model": config.ollama_model,
        "system": SYSTEM_PROMPT,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.2},
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{config.ollama_host.rstrip('/')}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")[:300]
        if exc.code == 404:
            raise BackendError(
                f"Ollama does not have model {config.ollama_model!r}. "
                f"Run: ollama pull {config.ollama_model}"
            ) from exc
        raise BackendError(f"Ollama error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise BackendError(
            f"Cannot reach Ollama at {config.ollama_host} ({exc.reason}). "
            "Start it with `ollama serve`."
        ) from exc
    return (data.get("response") or "").strip()


def _ask_anthropic(prompt: str, config: Config) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise BackendError("ANTHROPIC_API_KEY is not set.")
    payload = json.dumps({
        "model": config.anthropic_model,
        "max_tokens": 1500,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")[:300]
        raise BackendError(f"Anthropic API error {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise BackendError(f"Cannot reach the Anthropic API: {exc.reason}") from exc

    parts = [
        block.get("text", "")
        for block in data.get("content", [])
        if block.get("type") == "text"
    ]
    return "".join(parts).strip()
