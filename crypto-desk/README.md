# Crypto Day-Trade Desk

A single-page trading dashboard for **BTC / ETH / SOL** futures (Bitget), designed for a small
account ($10–40) trading with leverage. It shows, for each coin: bias, entry zones, TP1/TP2,
stop-loss, risk % and R:R — plus leverage-vs-liquidation "survival math", a position-size table,
session discipline rules, and a market-pulse strip (regime, Fear & Greed, ETF flow).

The page is published as a private Claude Artifact and bookmarked by the user.

- **File:** `desk.html` — fully self-contained (inline CSS/JS, no external requests).
- **Live link:** https://claude.ai/code/artifact/368ae923-c535-4266-b90d-6f0c6d90ff41
- **Favicon:** 📈

## How to update it (for a future Claude session)

The user updates on-demand — there is **no** auto-refresh schedule. When the user asks to
"update the desk":

1. **Fetch real, current data** via web search for each coin — price, support/resistance, RSI,
   trend — plus the crypto Fear & Greed index and any notable BTC ETF-flow / macro news.
   **Never invent numbers.** If a figure is unavailable, write "unavailable", not a guess.
2. **Edit `crypto-desk/desk.html`** — update each coin's trade plan (bias tag + card stripe class
   `long`/`short`/`neutral`, entry, TP1/TP2, stop, risk %, R:R), the masthead snapshot date, and
   the pulse strip (regime, Fear & Greed, ETF flow, stance).
3. **Republish to the same URL** by calling the Artifact tool with `url` set to the live link
   above (so the bookmark never changes), and `favicon: 📈`.
4. **Commit & push** the updated `desk.html` to branch `claude/crypto-day-trading-strategy-6m4xtj`.

## Design notes

- Trading-terminal aesthetic: dark by default, both light/dark themes via CSS tokens.
- Monospace tabular numerics; direction encoded by color + left card stripe so bias reads at a glance.
- Green = long, red = short, amber/gold = accent & neutral. Semantic colors are separate from the accent.
- The **⟳ Refresh data** button only copies the phrase `update desk` to the clipboard — it does
  **not** fetch or fabricate data (the sandbox blocks all network calls). Keep it honest: the page
  must never display numbers it did not receive from a real snapshot.

## Important

These are reactive technical levels, not predictions, and **not financial advice**. Every level is
timestamped and sourced on the page. The user places and manages all trades.
