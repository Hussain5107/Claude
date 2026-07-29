"""A local web UI, served from the standard library only.

Binds to 127.0.0.1 by default so the index is not exposed to the network.
"""

from __future__ import annotations

import html
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .answer import BackendError, generate, resolve_backend
from .config import Config
from .engine import Engine, IndexMissing
from .retrieve import snippet


def serve(
    root: Path,
    config: Config,
    *,
    host: str = "127.0.0.1",
    port: int = 8765,
    open_browser: bool = True,
) -> None:
    engine = Engine(root, config)
    if not engine.indexed:
        raise IndexMissing(f"{root} has not been indexed yet. Run: localsearch index {root}")

    lock = threading.Lock()  # sqlite connection is not shared across threads safely

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *args):  # keep the console quiet
            pass

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/":
                self._send(200, "text/html; charset=utf-8", PAGE.encode("utf-8"))
            elif parsed.path == "/api/status":
                with lock:
                    info = engine.stats()
                info["backend"] = resolve_backend(config)
                self._json(200, info)
            elif parsed.path == "/api/search":
                query = (parse_qs(parsed.query).get("q") or [""])[0].strip()
                if not query:
                    self._json(400, {"error": "missing query"})
                    return
                with lock:
                    hits = engine.search(query, limit=12)
                self._json(200, {"hits": [
                    {
                        "citation": h.citation,
                        "path": h.path,
                        "snippet": snippet(h.text, query),
                        "score": round(h.score, 5),
                    }
                    for h in hits
                ]})
            else:
                self._send(404, "text/plain; charset=utf-8", b"not found")

        def do_POST(self):
            if urlparse(self.path).path != "/api/ask":
                self._send(404, "text/plain; charset=utf-8", b"not found")
                return
            length = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                self._json(400, {"error": "invalid JSON"})
                return
            question = str(body.get("question", "")).strip()
            if not question:
                self._json(400, {"error": "missing question"})
                return
            try:
                with lock:
                    hits = engine.search(question)
                answer = generate(question, hits, config)
            except BackendError as exc:
                self._json(503, {"error": str(exc)})
                return
            self._json(200, {
                "answer": answer.text,
                "backend": answer.backend,
                "model": answer.model,
                "hits": [
                    {"citation": h.citation, "path": h.path, "text": h.text}
                    for h in answer.hits
                ],
            })

        def _json(self, status: int, payload: dict):
            self._send(status, "application/json; charset=utf-8",
                       json.dumps(payload).encode("utf-8"))

        def _send(self, status: int, content_type: str, body: bytes):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer((host, port), Handler)
    url = f"http://{host}:{port}"
    print(f"localsearch serving {root}")
    print(f"  {url}   (Ctrl-C to stop)")
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        server.server_close()
        engine.close()


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>localsearch</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff; --fg: #16181d; --muted: #666e7a;
    --line: #e3e6ea; --card: #f7f8fa; --accent: #3b6ef5;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14161a; --fg:#e9ecf1; --muted:#9aa3b0;
            --line:#2a2f38; --card:#1c1f26; --accent:#6f96ff; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size:20px; margin:0 0 4px; letter-spacing:-0.01em; }
  .status { color:var(--muted); font-size:13px; margin-bottom:24px; }
  form { display:flex; gap:8px; margin-bottom:8px; }
  input[type=text] { flex:1; padding:12px 14px; font-size:16px; color:var(--fg);
    background:var(--card); border:1px solid var(--line); border-radius:10px; }
  input[type=text]:focus { outline:2px solid var(--accent); outline-offset:-1px; }
  button { padding:12px 18px; font-size:15px; font-weight:600; color:#fff;
    background:var(--accent); border:0; border-radius:10px; cursor:pointer; }
  button:disabled { opacity:.55; cursor:default; }
  .modes { display:flex; gap:16px; font-size:13px; color:var(--muted); margin-bottom:28px; }
  .answer { white-space:pre-wrap; background:var(--card); border:1px solid var(--line);
    border-radius:12px; padding:18px 20px; margin-bottom:24px; }
  .meta { font-size:12px; color:var(--muted); margin-top:14px;
    padding-top:12px; border-top:1px solid var(--line); }
  .hit { border-top:1px solid var(--line); padding:16px 0; }
  .cite { font-size:13px; font-weight:600; color:var(--accent); word-break:break-all; }
  .snippet { font-size:14px; color:var(--muted); margin-top:6px; }
  details pre { white-space:pre-wrap; font-size:13px; background:var(--card);
    padding:12px; border-radius:8px; overflow-x:auto; }
  summary { cursor:pointer; font-size:13px; color:var(--muted); margin-top:8px; }
  .err { color:#c8322f; }
</style>
</head>
<body>
<div class="wrap">
  <h1>localsearch</h1>
  <div class="status" id="status">loading…</div>

  <form id="form">
    <input type="text" id="q" placeholder="Ask a question about your files…" autofocus>
    <button type="submit" id="go">Ask</button>
  </form>
  <div class="modes">
    <label><input type="radio" name="mode" value="ask" checked> Ask (answer with citations)</label>
    <label><input type="radio" name="mode" value="search"> Search (passages only)</label>
  </div>

  <div id="out"></div>
</div>
<script>
const out = document.getElementById('out');
const go = document.getElementById('go');
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

fetch('/api/status').then(r => r.json()).then(s => {
  const vec = s.vectors ? `${s.vectors} vectors` : 'keyword only';
  document.getElementById('status').textContent =
    `${s.files} files · ${s.chunks} chunks · ${vec} · backend: ${s.backend} · ${s.root}`;
});

document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const q = document.getElementById('q').value.trim();
  if (!q) return;
  const mode = document.querySelector('input[name=mode]:checked').value;
  go.disabled = true;
  out.innerHTML = '<div class="status">searching…</div>';
  try {
    out.innerHTML = mode === 'ask' ? await ask(q) : await search(q);
  } catch (err) {
    out.innerHTML = `<div class="answer err">${esc(String(err))}</div>`;
  } finally {
    go.disabled = false;
  }
});

async function ask(q) {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({question: q})
  });
  const data = await res.json();
  if (!res.ok) return `<div class="answer err">${esc(data.error || 'request failed')}</div>`;
  const sources = data.hits.map((h, i) =>
    `<details><summary>[${i + 1}] ${esc(h.citation)}</summary><pre>${esc(h.text)}</pre></details>`
  ).join('');
  return `<div class="answer">${esc(data.answer)}
    <div class="meta">${esc(data.backend)}${data.model === '-' ? '' : ' / ' + esc(data.model)}</div>
    </div>${sources}`;
}

async function search(q) {
  const res = await fetch('/api/search?q=' + encodeURIComponent(q));
  const data = await res.json();
  if (!res.ok) return `<div class="answer err">${esc(data.error || 'request failed')}</div>`;
  if (!data.hits.length) return '<div class="answer">No matches.</div>';
  return data.hits.map(h =>
    `<div class="hit"><div class="cite">${esc(h.citation)}</div>
     <div class="snippet">${esc(h.snippet)}</div></div>`
  ).join('');
}
</script>
</body>
</html>
"""
