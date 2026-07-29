# Installing ai-job-search

Setup notes for [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search)
— a Claude Code framework that scrapes job portals, tailors your CV and cover
letter per application, compiles them to PDF via LaTeX, and runs interview prep.

These steps were verified against upstream `master` on 2026-07-29. What was
actually tested is marked below; what wasn't, is marked too.

## What runs where

The framework is a **local-machine tool**. Two of its three legs don't work in a
Claude Code cloud session:

| Capability | Local machine | Cloud session |
|---|---|---|
| `/scrape` — search job portals | works | **blocked** — the network policy denies linkedin.com, jobindex.dk, jobnet.dk, indeed.com (proxy returns `403 to CONNECT`) |
| `/apply` — PDF compile | works | **needs LaTeX installed per session** (not preinstalled) |
| `/apply` — fit evaluation, CV + cover letter drafting from pasted job text | works | works |
| `/interview`, `/rank`, `/outcome`, `/upskill` | works | works |

So: install locally for the full workflow. The GitHub repo is worth having
anyway so your profile and application history follow you across machines.

## 1. Local install

### Prerequisites

**macOS:**

```bash
brew install --cask mactex          # or: brew install --cask basictex (smaller)
brew install poppler                # pdftotext, for the ATS check
curl -fsSL https://bun.sh/install | bash
npm install -g @anthropic-ai/claude-code
```

**Windows (PowerShell):**

```powershell
winget install MiKTeX.MiKTeX
winget install Oven-sh.Bun
choco install poppler
npm install -g @anthropic-ai/claude-code
```

On Basic MiKTeX, turn on silent package auto-install first, or Claude Code's
Bash tool will hang on GUI prompts:

```powershell
initexmf --set-config-value=[MPM]AutoInstall=1
```

Python 3.10+ is required. **Verified:** the Python tools (`salary_lookup.py`,
`tools/*.py`) run on 3.11 using only the standard library — no `pip install`
needed unless you use the Excel salary converter, which needs `openpyxl`.

### Fork, clone, install

```bash
gh repo fork MadsLorentzen/ai-job-search --clone
cd ai-job-search

for tool in jobbank-search jobdanmark-search jobindex-search jobnet-search linkedin-search freehire-search; do
  (cd .agents/skills/$tool/cli && bun install)
done
```

**Verified:** all six installed clean (125 packages for the scraper CLIs, 5 for
the two zero-dependency ones).

### Check it

```bash
python3 tools/lint_skills.py     # expect: lint_skills: OK (9 skills, 12 commands, settings.json)
```

**Verified:** passes on a fresh clone.

If you cloned an older version, delete the stale broad-permission file:

```bash
rm -f .claude/settings.local.json
```

### Run it

```bash
claude
```

Then `/setup` — it interviews you (or reads a CV you drop in `documents/`) and
populates `CLAUDE.md`, the profile skill files, `cv/main_example.tex`, and
`search-queries.md`. After that: `/scrape` to find jobs, `/apply <url>` to
generate an application, `/interview` to prep.

## 2. UAE / Gulf note

Four of the six bundled portals are Danish (`jobbank`, `jobdanmark`,
`jobindex`, `jobnet`) and are dead weight outside Denmark. Set
`enabled: false` in their `SKILL.md` frontmatter so `/scrape` skips them.

The two country-agnostic ones do cover the Gulf:

- **`linkedin-search`** — any location, passed explicitly.
  `bun run .agents/skills/linkedin-search/cli/src/cli.ts search -q "R&D chemist" -l "Dubai, United Arab Emirates" --jobage 30 --format table`
- **`freehire-search`** — aggregates ~50 ATS platforms, but tech-first.

For Bayt, GulfTalent or Naukrigulf, run `/add-portal` — it scaffolds the same
CLI structure for any public job board, test-runs a live query, and registers
the skill. Do this on your local machine; it needs live network access to the
portal.

## 3. Keeping up with upstream

```bash
git fetch upstream
python3 tools/check_upstream_updates.py   # lists which methodology files changed
git merge upstream/master
```

Commit your `/setup` personalization first, or the merge will refuse. Conflicts
in personalized files are expected and meaningful — keep your data, adopt the
methodology change around it.

## Not verified here

- LaTeX compilation of the CV and cover letter templates (no TeX in the test container)
- Any live portal query (network policy blocked every job board)
- `/setup`, `/apply`, `/interview` end to end (they need Claude Code running inside the repo)
