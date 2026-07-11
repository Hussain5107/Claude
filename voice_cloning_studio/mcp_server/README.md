# Zahra Studio MCP bridge

Lets **Claude Desktop** (the desktop app on your PC — not this web session)
write a script and narrate it in your cloned voice, all in one conversation.
Claude gets six tools: `list_voices`, `clone_voice_from_file`,
`submit_narration`, `check_narration_status`, `wait_for_narration`,
`get_narration_result`.

This only works with **Claude Desktop**, because it needs to run a process
on your own machine that can reach `localhost:8000` — a web/browser Claude
session can't do that.

## Setup (one-time)

**1. Install Claude Desktop** if you don't have it: https://claude.ai/download

**2. Install this bridge's dependencies** into the same venv you already use
for the backend:
```
cd E:\AI\voice_cloning_studio\voice_cloning_studio
venv\Scripts\activate
pip install -r mcp_server\requirements.txt
```

**3. Find your Python path** (you'll need the exact path for the config
below):
```
where python
```
Copy the path that's inside your `venv` folder, e.g.
`E:\AI\voice_cloning_studio\voice_cloning_studio\venv\Scripts\python.exe`.

**4. Edit Claude Desktop's config file.** In Claude Desktop, go to
Settings -> Developer -> Edit Config (or open
`%APPDATA%\Claude\claude_desktop_config.json` directly in a text editor).
Add this (merge with any existing `mcpServers` entries — don't replace the
whole file if there's already content):

```json
{
  "mcpServers": {
    "zahra-studio": {
      "command": "E:\\AI\\voice_cloning_studio\\voice_cloning_studio\\venv\\Scripts\\python.exe",
      "args": ["E:\\AI\\voice_cloning_studio\\voice_cloning_studio\\mcp_server\\zahra_mcp.py"]
    }
  }
}
```
(use the exact python.exe path from step 3, and double-check the `args`
path matches where you actually unzipped the project)

**5. Restart Claude Desktop completely** (quit, not just close the window).

## Using it

**Start the Zahra Studio backend first** (`start_backend.bat`) — the bridge
just forwards requests to it, so it needs to already be running. The
Gradio frontend (`start_frontend.bat`) is optional now; you can drive
everything from Claude Desktop instead, or use both side by side.

Then in Claude Desktop, just talk normally:

> "Write me a 30-second script about the history of coffee, then narrate it
> using my Ivy voice."

Claude will draft the text, call `list_voices` to confirm "Ivy" exists,
`submit_narration`, wait for it, and tell you where the finished audio (and
captions) landed on your computer — by default in
`C:\Users\<you>\ZahraStudioNarrations\`.

For long scripts (30-60 min), Claude won't block waiting — it'll submit the
job and tell you to check back; ask it to "check on that narration job" a
bit later and it'll call `check_narration_status` /
`get_narration_result` for you.

## Troubleshooting

- **Claude Desktop doesn't show the tools:** confirm the config file is
  valid JSON (a trailing comma will break it), and that you fully restarted
  the app.
- **"Could not reach backend" errors:** make sure `start_backend.bat` is
  running in a terminal window — the bridge has no ML code of its own, it's
  just relaying to that server.
- **Wrong Python / `mcp` not found:** the `command` path in the config must
  point at the venv's `python.exe` specifically (not a system Python), and
  step 2's `pip install` must have been run inside that same venv.
