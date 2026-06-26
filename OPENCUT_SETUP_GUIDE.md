# OpenCut Setup Guide

OpenCut is a free, open-source video editor for web, desktop, and mobile — an open-source alternative to CapCut. It is currently being rewritten from scratch with a Rust core and plugin architecture.

Repository: https://github.com/OpenCut-app/OpenCut

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| [proto](https://moonrepo.dev/proto) | Version manager for bun and moon |
| [bun](https://bun.sh) | Package manager & runtime (installed via proto) |
| [moon](https://moonrepo.dev) | Monorepo task runner (installed via proto) |
| Git | Clone the repository |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/OpenCut-app/OpenCut.git
cd OpenCut
```

---

## Step 2 — Install proto

proto manages the exact versions of bun and moon pinned by the project (defined in `.prototools`).

```bash
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)
```

After installation, restart your terminal (or `source ~/.bashrc` / `source ~/.zshrc`) so `proto` is on your PATH.

---

## Step 3 — Install pinned toolchain

From the repository root:

```bash
proto use
```

This reads `.prototools` and installs the exact versions of bun and moon the project requires.

---

## Step 4 — Install dependencies

```bash
bun install
```

---

## Step 5 — Run the development servers

### Web app (frontend)

```bash
moon run web:dev
```

Opens at: **http://localhost:5173**

### API server (backend)

```bash
moon run api:dev
```

Runs at: **http://localhost:8787**

You can run both servers simultaneously in separate terminal tabs.

---

## Quick-start summary

```bash
# 1. Install proto (one-time)
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)

# 2. Restart terminal, then:
git clone https://github.com/OpenCut-app/OpenCut.git
cd OpenCut
proto use        # install bun + moon
bun install      # install JS dependencies

# 3. Start dev servers (two terminals)
moon run web:dev   # http://localhost:5173
moon run api:dev   # http://localhost:8787
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `proto: command not found` | Restart terminal after installing proto; check `~/.proto/bin` is in PATH |
| `bun: command not found` | Run `proto use` first to install bun |
| `moon: command not found` | Run `proto use` first to install moon |
| Port already in use | Kill the process using the port: `lsof -ti:5173 \| xargs kill` |
| `bun install` fails on native deps | Ensure you have a C/C++ compiler (`build-essential` on Ubuntu, Xcode CLI tools on macOS) |

---

## Notes

- The project is under active rewrite; breaking changes are expected.
- The stable legacy version runs at https://opencut.app (source: [opencut-classic](https://github.com/opencut-app/opencut-classic)).
- Contributions are currently paused while the core architecture is being designed. Follow GitHub issues or join their Discord for updates.
