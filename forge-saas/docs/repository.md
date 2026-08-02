# Which repository is this?

## `Hussain5107/forge-saas` is canonical

**This is the only repository that should receive FORGE changes.** Vercel builds from
it. A change pushed anywhere else does not reach production.

| | |
|---|---|
| Repository | `Hussain5107/forge-saas` |
| Branch | `main` |
| Vercel Root Directory | `forge-saas` (the app lives in a subdirectory) |
| Deployed | `claude-alpha-dun.vercel.app` |

---

## Why this document exists

The same application lived in two repositories with divergent history:

- `Hussain5107/Claude`, branch `forge-saas-app`
- `Hussain5107/forge-saas`, branch `main`

They were not forks — the second was created by copying files during a GitHub
reorganisation, so the two histories share no commits and Git cannot tell you whether
they agree. Keeping them in step was manual, and manual is why it failed.

**It cost real time.** On 2026-08-01, four changes — the mobile redesign, the theme
system, cycle tracking, and a fix for log out returning HTTP 405 — were pushed to
`Claude` and never reached production. The reported symptoms were "no UI change, no
theme change" and a logout error that persisted after being fixed. The code was correct
and pushed; it was pushed to the repository Vercel does not build. Diagnosis took
several hours of looking in the wrong place.

The drift recurred within the same day: two documentation commits landed in `Claude`
and were missing from `forge-saas` a few hours after the first sync.

This is recorded as Audit §12 R3 (High) and as Phase 0 task 0.1 in
`docs/kids-mode/05-delivery-roadmap.md`.

---

## Rules

1. **Push FORGE changes to `Hussain5107/forge-saas` only.**
2. `Hussain5107/Claude` retains the app's full commit history and is kept as an archive.
   Do not push application changes to it.
3. If you find yourself syncing files between the two, stop — that is the failure mode
   this document exists to prevent.
4. Before assuming a change is live, check that the newest Vercel deployment is the
   commit you expect, on `forge-saas`.

---

## Verifying the two are in sync

They were last verified identical (app subtree, byte-for-byte) at `forge-saas` commit
`37d437f`. To re-check:

```bash
# from a clone of each, compare the app subtree
diff -r --brief \
  path/to/Claude/forge-saas \
  path/to/forge-saas/forge-saas \
  -x .git -x node_modules -x .next -x .env.local
```

No output means identical.

---

## Known wart, deliberately not fixed

The `forge-saas` repository contains the app in a nested `forge-saas/` subdirectory
rather than at the root, because it was copied from the `Claude` repository's layout.

Flattening it would be tidier, but Vercel's **Root Directory** setting points at
`forge-saas`, and changing the repository layout without changing that setting at the
same moment breaks the deployment. It is not worth the risk for cosmetics.

If it is ever flattened, the Vercel Root Directory must be cleared in the same change.

---

## Outstanding: retiring the duplicate

The `Claude` repository still contains a full copy of the app under `forge-saas/` on the
`forge-saas-app` branch. It is inert — nothing builds from it — but while it exists,
someone (including an AI agent) can commit to it by mistake.

Removing that copy would close the failure mode permanently. It has **not** been done,
because deleting an application from a repository is the owner's call, not an automated
one. The history would be preserved by Git either way.

**Decision needed from the owner.** Until then, rule 1 above is the control.
