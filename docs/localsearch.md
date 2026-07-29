# localsearch — a local AI search engine for a folder

Point it at a folder. It indexes everything readable inside, then answers your
questions in plain language with citations back to the exact file the answer
came from.

Everything runs on your machine. The index is a single SQLite file inside the
folder itself (`.localsearch/index.db`). With Ollama as the answer backend,
nothing ever leaves your computer.

```
$ localsearch index ~/Documents/Projects
3,412 added, 0 updated, 0 removed, 18,904 chunks in 41.2s

$ localsearch ask -f ~/Documents/Projects "what warranty did we give Al Noor Tower?"
Ten years on materials and five years on workmanship [1]. Claims have to be
filed with the contractor within 30 days of discovery [1].

Sources
  [1] clients/al-noor/warranty.txt#0
via ollama / llama3.1:8b
```

## Install

Requires Python 3.10+. No mandatory dependencies.

```bash
git clone <this repo> && cd <this repo>
pip install -e .                 # keyword search, works immediately
pip install -e ".[all]"          # + semantic search, PDF and XLSX support
```

Installing gives you a `localsearch` command. Without installing, use
`python3 -m localsearch` from the repo root — every example below works either
way.

## Use it

```bash
localsearch index  ~/Documents/Notes      # build the index (repeat to refresh)
localsearch ask    -f ~/Documents/Notes "when is the Dubai permit due?"
localsearch search -f ~/Documents/Notes "permit"     # passages only, no model
localsearch chat   ~/Documents/Notes                 # interactive loop
localsearch serve  ~/Documents/Notes                 # web UI on localhost:8765
localsearch status ~/Documents/Notes
```

Set `LOCALSEARCH_FOLDER` so you can drop the path entirely:

```bash
export LOCALSEARCH_FOLDER=~/Documents/Notes
localsearch ask "what did we quote Delta Chemicals?"
```

Re-running `index` is incremental — only files whose size or modification time
changed are re-read, and files you deleted are dropped from the index. Run it
after you add documents, or from a cron job / Task Scheduler entry.

## Getting written answers

Retrieval always works. Generating prose answers needs a model, chosen
automatically in this order:

| Backend | How to enable | Privacy |
|---|---|---|
| `ollama` | `ollama serve` + `ollama pull llama3.1:8b` | fully local, nothing leaves the machine |
| `anthropic` | `export ANTHROPIC_API_KEY=sk-ant-…` | retrieved excerpts are sent to the API |
| `none` | fallback when neither is available | ranked excerpts, no prose |

Ollama is preferred whenever it is reachable. Override per command with
`--backend ollama|anthropic|none` and `--model <name>`, or permanently:

```bash
localsearch config ~/Documents/Notes --set backend=ollama --set ollama_model=llama3.1:8b
```

**Recommended local models.** `llama3.1:8b` is a good default on 16 GB of RAM.
`qwen2.5:14b` answers noticeably better if you have 32 GB. `llama3.2:3b` works
on a light laptop but gets vaguer with long excerpts.

## Semantic search (optional)

By default retrieval is BM25 keyword ranking — fast, zero-dependency, and
strong when your wording overlaps the documents. Semantic search additionally
matches on meaning ("cost overrun" finding "went over budget"):

```bash
pip install "sentence-transformers numpy"
localsearch index ~/Documents/Notes --embeddings
```

The first run downloads a ~90 MB embedding model, then runs offline forever
after. Keyword and semantic result lists are merged with reciprocal rank
fusion, so a passage that either method ranks highly still surfaces.

Embedding a large folder is much slower than keyword indexing. Start without
it; add it if keyword results feel too literal.

## What gets indexed

Read with no extra libraries: `.txt` `.md` `.rst` `.csv` `.tsv` `.json`
`.yaml` `.toml` `.html` `.xml` `.docx` `.pptx` `.epub` and common source files.
PDFs need `pypdf`; `.xlsx` needs `openpyxl` (both in `[formats]`).

Skipped automatically: hidden files, `node_modules`, `.git`, `venv`, build
directories, anything over 25 MB, and scanned PDFs with no text layer. See
what was passed over and why:

```bash
localsearch status ~/Documents/Notes --skipped
```

Adjust the rules per folder:

```bash
localsearch config ~/Documents/Notes \
  --set max_file_mb=100 \
  --set exclude_globs="drafts/*,archive/**" \
  --set chunk_size=1600
```

All settings live in `<folder>/.localsearch/config.json`. `localsearch config
<folder>` with no flags prints the current values.

## Web UI

```bash
localsearch serve ~/Documents/Notes
```

Opens a single-page interface at `http://127.0.0.1:8765` with an **Ask** mode
(cited answer, expandable source excerpts) and a **Search** mode (ranked
passages). It binds to localhost only — pass `--host 0.0.0.0` deliberately if
you want other devices on your network to reach it, and be aware that exposes
the contents of the folder to anyone who can reach that port.

## Use it from Python

```python
from localsearch.engine import Engine

with Engine("~/Documents/Notes") as engine:
    for hit in engine.search("softening point"):
        print(hit.citation, hit.score)

    answer = engine.ask("what softening point did we specify?")
    print(answer.text, answer.sources())
```

## How it works

1. **Walk** the folder, honouring exclusions, skipping unchanged files.
2. **Extract** text per format (see loaders.py).
3. **Chunk** to ~1200 characters on paragraph → line → sentence boundaries,
   with 200 characters of overlap so an answer is never cut in half.
4. **Index** into SQLite: a `chunks` table plus a hand-built `postings`
   inverted index (portable across Python builds, and tokenization is
   guaranteed identical at index and query time).
5. **Retrieve** with BM25, optionally fused with cosine similarity over stored
   embeddings via reciprocal rank fusion.
6. **Answer** by handing the top chunks to a model under a prompt that forbids
   outside knowledge and requires `[n]` citations.

Citations are `path#ordinal` — the file, and which chunk within it.

## Troubleshooting

**"has not been indexed yet"** — run `localsearch index <folder>` first.

**Answers say the excerpts don't contain it** — that is the prompt working as
intended rather than inventing something. Widen retrieval with `-k 15`, or try
`localsearch search` to see whether the passage is being retrieved at all. If
it isn't, the content may be in a skipped file (`status --skipped`) or a
scanned PDF.

**"Cannot reach Ollama"** — start `ollama serve`; if it runs on another host,
`--set ollama_host=http://192.168.1.10:11434`.

**Results feel too literal** — enable semantic search (above).

**Starting fresh** — `localsearch index <folder> --rebuild`, or just delete the
`.localsearch` directory.

## Tests

```bash
pip install pytest && python3 -m pytest
```
