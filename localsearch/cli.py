"""Command line interface: index, ask, search, chat, serve, status, config."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .answer import BackendError, ollama_available, resolve_backend
from .config import Config, config_path, resolve_root
from .embeddings import EmbeddingsUnavailable, available as embeddings_available
from .engine import Engine, IndexMissing
from .retrieve import snippet

BOLD, DIM, CYAN, YELLOW, RESET = "\033[1m", "\033[2m", "\033[36m", "\033[33m", "\033[0m"


def _color(enabled: bool):
    if enabled and sys.stdout.isatty():
        return BOLD, DIM, CYAN, YELLOW, RESET
    return "", "", "", "", ""


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "command", None):
        parser.print_help()
        return 0
    try:
        return args.func(args)
    except IndexMissing as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except EmbeddingsUnavailable as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except BackendError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3
    except NotADirectoryError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print()
        return 130
    except BrokenPipeError:
        # Downstream command (`| head`) closed the pipe. Redirect stdout to
        # devnull so the interpreter's own flush at exit stays quiet too.
        import os

        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="localsearch",
        description="A local AI search engine over a folder of your own files.",
    )
    parser.add_argument("--version", action="version", version=f"localsearch {__version__}")
    parser.add_argument("--no-color", action="store_true", help="disable colored output")
    sub = parser.add_subparsers(dest="command")

    def add_folder(p):
        p.add_argument(
            "folder",
            nargs="?",
            default=None,
            help="folder to search (default: $LOCALSEARCH_FOLDER or the current directory)",
        )

    p_index = sub.add_parser("index", help="build or refresh the index for a folder")
    add_folder(p_index)
    p_index.add_argument("--rebuild", action="store_true", help="discard and rebuild from scratch")
    p_index.add_argument("--embeddings", action="store_true", help="also build semantic vectors")
    p_index.add_argument("--no-embeddings", action="store_true", help="keyword index only")
    p_index.add_argument("--quiet", "-q", action="store_true", help="only print the summary")
    p_index.set_defaults(func=cmd_index)

    p_ask = sub.add_parser("ask", help="ask a question and get a cited answer")
    p_ask.add_argument("question", nargs="+")
    p_ask.add_argument("-f", "--folder", default=None)
    p_ask.add_argument("-k", "--top-k", type=int, default=None, help="chunks to retrieve")
    p_ask.add_argument("--backend", choices=["auto", "ollama", "anthropic", "none"])
    p_ask.add_argument("--model", default=None, help="override the model name")
    p_ask.add_argument("--show-sources", action="store_true", help="print the excerpts used")
    p_ask.set_defaults(func=cmd_ask)

    p_search = sub.add_parser("search", help="retrieve matching passages, no model involved")
    p_search.add_argument("query", nargs="+")
    p_search.add_argument("-f", "--folder", default=None)
    p_search.add_argument("-k", "--top-k", type=int, default=10)
    p_search.add_argument("--full", action="store_true", help="print whole chunks")
    p_search.set_defaults(func=cmd_search)

    p_chat = sub.add_parser("chat", help="interactive question loop")
    add_folder(p_chat)
    p_chat.add_argument("--backend", choices=["auto", "ollama", "anthropic", "none"])
    p_chat.set_defaults(func=cmd_chat)

    p_serve = sub.add_parser("serve", help="run the local web UI")
    add_folder(p_serve)
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8765)
    p_serve.add_argument("--no-browser", action="store_true")
    p_serve.set_defaults(func=cmd_serve)

    p_status = sub.add_parser("status", help="show index and backend status")
    add_folder(p_status)
    p_status.add_argument("--skipped", action="store_true", help="list files that were skipped")
    p_status.set_defaults(func=cmd_status)

    p_config = sub.add_parser("config", help="view or change per-folder settings")
    add_folder(p_config)
    p_config.add_argument("--set", metavar="KEY=VALUE", action="append", default=[])
    p_config.set_defaults(func=cmd_config)

    return parser


# --- commands ---------------------------------------------------------------

def cmd_index(args) -> int:
    bold, dim, cyan, _yellow, reset = _color(not args.no_color)
    root = resolve_root(args.folder)
    config = Config.load(root)

    if args.embeddings and args.no_embeddings:
        print("error: --embeddings and --no-embeddings conflict", file=sys.stderr)
        return 2
    if args.embeddings:
        if not embeddings_available():
            print(
                "error: semantic search needs `pip install sentence-transformers numpy`",
                file=sys.stderr,
            )
            return 2
        config.embeddings = True
    elif args.no_embeddings:
        config.embeddings = False
    config.save(root)

    print(f"{bold}Indexing{reset} {root}")
    if config.embeddings:
        print(f"{dim}  embeddings: {config.embedding_model} (first run downloads the model){reset}")
    progress = None if args.quiet else (lambda msg: print(f"{dim}{msg}{reset}"))

    with Engine(root, config) as engine:
        result = engine.index(rebuild=args.rebuild, progress=progress)

    print(f"{cyan}{result.summary()}{reset}")
    if result.skipped and not args.quiet:
        print(f"{dim}Skipped:{reset}")
        for path, reason in result.skipped[:20]:
            print(f"{dim}  {path}: {reason}{reset}")
        if len(result.skipped) > 20:
            print(f"{dim}  … and {len(result.skipped) - 20} more (see `localsearch status --skipped`){reset}")
    return 0


def cmd_ask(args) -> int:
    bold, dim, cyan, _yellow, reset = _color(not args.no_color)
    question = " ".join(args.question)
    root = resolve_root(args.folder)
    config = _config_with_overrides(root, args)

    with Engine(root, config) as engine:
        answer = engine.ask(question, limit=args.top_k)

    print(answer.text)
    if answer.hits:
        print()
        print(f"{bold}Sources{reset}")
        for i, hit in enumerate(answer.hits, start=1):
            print(f"  {cyan}[{i}]{reset} {hit.citation}")
        print(f"{dim}via {answer.backend}"
              f"{'' if answer.model == '-' else ' / ' + answer.model}{reset}")
    if args.show_sources:
        print()
        for i, hit in enumerate(answer.hits, start=1):
            print(f"{bold}[{i}] {hit.citation}{reset}")
            print(hit.text)
            print()
    return 0


def cmd_search(args) -> int:
    bold, dim, cyan, _yellow, reset = _color(not args.no_color)
    query = " ".join(args.query)
    with Engine(args.folder) as engine:
        hits = engine.search(query, limit=args.top_k)

    if not hits:
        print("No matches.")
        return 1
    for i, hit in enumerate(hits, start=1):
        marks = []
        if hit.keyword_rank is not None:
            marks.append(f"kw#{hit.keyword_rank + 1}")
        if hit.semantic_rank is not None:
            marks.append(f"sem#{hit.semantic_rank + 1}")
        print(f"{cyan}[{i}]{reset} {bold}{hit.citation}{reset} "
              f"{dim}score {hit.score:.4f} {' '.join(marks)}{reset}")
        body = hit.text if args.full else snippet(hit.text, query)
        print(f"    {' '.join(body.split()) if not args.full else body}")
        print()
    return 0


def cmd_chat(args) -> int:
    bold, dim, cyan, _yellow, reset = _color(not args.no_color)
    root = resolve_root(args.folder)
    config = _config_with_overrides(root, args)

    with Engine(root, config) as engine:
        info = engine.stats()
        backend = resolve_backend(config)
        print(f"{bold}localsearch{reset} — {info['files']} files, {info['chunks']} chunks "
              f"in {root}")
        print(f"{dim}backend: {backend}. Ctrl-C or 'exit' to quit.{reset}\n")
        while True:
            try:
                question = input(f"{cyan}?{reset} ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                return 0
            if not question:
                continue
            if question.lower() in {"exit", "quit", ":q"}:
                return 0
            try:
                answer = engine.ask(question)
            except BackendError as exc:
                print(f"error: {exc}\n", file=sys.stderr)
                continue
            print(f"\n{answer.text}\n")
            if answer.hits:
                cites = ", ".join(f"[{i}] {h.citation}" for i, h in enumerate(answer.hits, 1))
                print(f"{dim}{cites}{reset}\n")


def cmd_serve(args) -> int:
    from .server import serve

    root = resolve_root(args.folder)
    config = Config.load(root)
    serve(root, config, host=args.host, port=args.port, open_browser=not args.no_browser)
    return 0


def cmd_status(args) -> int:
    bold, dim, cyan, yellow, reset = _color(not args.no_color)
    root = resolve_root(args.folder)
    config = Config.load(root)

    print(f"{bold}Folder{reset}  {root}")
    if not Engine(root, config).indexed:
        print(f"{yellow}Not indexed yet. Run: localsearch index {root}{reset}")
        return 1

    with Engine(root, config) as engine:
        info = engine.stats()
        print(f"{bold}Index{reset}   {info['files']} files, {info['chunks']} chunks, "
              f"{info['terms']} terms, avg {info['avg_tokens']:.0f} tokens/chunk")
        if info["vectors"]:
            print(f"{bold}Vectors{reset} {info['vectors']} ({info['embedding_model']})")
        else:
            extra = "" if embeddings_available() else " — install sentence-transformers numpy"
            print(f"{dim}Vectors  none (keyword search only){extra}{reset}")

        backend = resolve_backend(config)
        detail = {
            "ollama": f"{config.ollama_model} at {config.ollama_host}",
            "anthropic": config.anthropic_model,
            "none": "no model configured — `search` still works",
        }.get(backend, "")
        print(f"{bold}Backend{reset} {cyan}{backend}{reset} {dim}{detail}{reset}")
        if backend != "ollama" and not ollama_available(config.ollama_host):
            print(f"{dim}         (start `ollama serve` for fully offline answers){reset}")

        if info["skipped"]:
            print(f"{dim}Skipped  {info['skipped']} files{reset}")
            if args.skipped:
                for path, reason in engine.skipped():
                    print(f"{dim}  {path}: {reason}{reset}")
    return 0


def cmd_config(args) -> int:
    bold, dim, _cyan, _yellow, reset = _color(not args.no_color)
    root = resolve_root(args.folder)
    config = Config.load(root)

    if args.set:
        fields = Config.__dataclass_fields__
        for assignment in args.set:
            if "=" not in assignment:
                print(f"error: expected KEY=VALUE, got {assignment!r}", file=sys.stderr)
                return 2
            key, _, raw = assignment.partition("=")
            key = key.strip()
            if key not in fields:
                print(f"error: unknown setting {key!r}. Known: {', '.join(sorted(fields))}",
                      file=sys.stderr)
                return 2
            setattr(config, key, _coerce(fields[key].type, raw.strip()))
        config.save(root)
        print(f"{dim}Saved {config_path(root)}{reset}")

    print(f"{bold}Settings for {root}{reset}")
    for key in sorted(Config.__dataclass_fields__):
        value = getattr(config, key)
        print(f"  {key} = {value!r}")
    return 0


# --- helpers ----------------------------------------------------------------

def _config_with_overrides(root: Path, args) -> Config:
    config = Config.load(root)
    backend = getattr(args, "backend", None)
    if backend:
        config.backend = backend
    model = getattr(args, "model", None)
    if model:
        if (backend or resolve_backend(config)) == "anthropic":
            config.anthropic_model = model
        else:
            config.ollama_model = model
    top_k = getattr(args, "top_k", None)
    if top_k:
        config.top_k = top_k
    return config


def _coerce(type_hint, raw: str):
    hint = str(type_hint)
    if "bool" in hint:
        if raw.lower() in {"true", "1", "yes", "on"}:
            return True
        if raw.lower() in {"false", "0", "no", "off"}:
            return False
        raise SystemExit(f"error: {raw!r} is not a boolean")
    if "list" in hint:
        return [piece.strip() for piece in raw.split(",") if piece.strip()]
    if "float" in hint:
        return float(raw)
    if "int" in hint:
        return int(raw)
    return raw


if __name__ == "__main__":
    raise SystemExit(main())
