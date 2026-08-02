# Database migrations — the convention from here forward

## Two files, two jobs

| File | Job |
|---|---|
| `supabase/schema.sql` | **Historical record.** Sections 1–18, already applied to production. Frozen. |
| `supabase/migrations/*.sql` | **Everything new**, starting with Kids Mode. |

`schema.sql` is not retired — a fresh Supabase project still needs it run once,
in full, before anything in this folder applies. It just stops growing.

## Why split now, rather than retrofit

`schema.sql` has worked because every statement in it is idempotent (`if not
exists`, `or replace`, `drop policy if exists`) — but there is no record of
*when* each of its 18 sections was applied, and no ordering guarantee if it
were ever split apart after the fact. Rewriting 18 sections of history into
timestamped migration files risks breaking a database that currently works,
for a benefit no user would ever see. Not worth it.

Splitting **forward** costs nothing and buys the thing that was actually
missing: from the next schema change on, there is a record of what shipped,
when, and in what order.

## Adding a change

1. **Back up first.** `./scripts/backup-db.sh` — see `docs/backups.md`. Every
   migration is a live edit to the only copy of production data that exists.
2. Create `supabase/migrations/YYYYMMDDHHMM_short_description.sql`.
3. Write it the same way `schema.sql` already does: `if not exists`, `or
   replace`, `drop policy if exists` before `create policy`. A migration that
   can be re-run without erroring is a migration that's safe to re-run when
   something goes wrong halfway through.
4. Additive only for existing tables. A new column, a new table, a new
   policy — yes. Renaming or retyping an existing column — no, per
   `docs/kids-mode/00-principles.md` P1.
5. Run it in the Supabase SQL Editor (same process as `schema.sql` today —
   there is no automated apply step yet; see "What this is not" below).
6. Record what you ran and when, at the bottom of this file.

## What this is not

**Not automated.** There is no `supabase db push` wired into CI, and no
migration-tracking table recording what has been applied. Every migration is
still a manual paste into the SQL Editor, exactly like `schema.sql` always was
— the only change is that new work is now one small file per change instead of
one growing file, with a name and a date attached.

Automating this (the `supabase` CLI, now a dev dependency, can do it) is a
reasonable next step, but it wants its own decision about *how* — a shadow
database for `db diff`, a service-role secret in CI, a review gate before
`db push` runs against production. That is more than Phase 0 should decide
unilaterally the same day migrations were split out. Recorded as a candidate
in `docs/kids-mode/01-decisions.md`.

## Applied

Nothing yet. The first entry here should be the Kids Mode `child_profiles`
migration (Phase 1) — see `docs/kids-mode/05-delivery-roadmap.md`.

| Date | File | Applied by |
|---|---|---|
| — | — | — |
