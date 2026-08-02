# Workout Forge — Kids Mode

Planning documentation, plus (as of Phase 0) the engineering safety net Kids Mode gets
built on. **No Kids Mode user-facing feature exists.** No child route, no child table,
no child data, no video integration. Nothing outside `docs/kids-mode/`,
`supabase/migrations/`, `supabase/tests/`, test files colocated in `src/lib/`, and a
handful of tooling files (`vitest.config.mts`, `.github/workflows/ci.yml`,
`scripts/backup-db.sh`) has been created or modified.

## Evidence baseline

Every claim in these documents traces to one of two sources:

| Source | Citation form |
|---|---|
| `docs/architecture-audit.md` | "Audit §7" |
| The repository itself | `path/to/file.ts:LINE` |

Where neither supports a statement, it is marked **Inferred** or **Open Decision** and
must not be treated as settled.

## Confidence markers

Every recommendation in these documents carries one:

| Marker | Meaning |
|---|---|
| **Verified** | Supported by a cited audit section or a cited file and line. Safe to build on. |
| **Inferred** | A reasonable engineering judgement from verified facts, but not itself verified. Challengeable. |
| **Open Decision** | Requires a named human to decide. **Blocks the work that depends on it.** |
| **Decided** *(Part C of `01-decisions.md` only)* | A reversible, non-user-facing engineering choice made and recorded per the Decision Rule — not escalated, because it didn't need to be. Still challengeable. |

## Documents

| File | Purpose | Read if you are |
|---|---|---|
| `00-principles.md` | The non-negotiables, and what "done" means | Everyone, first |
| `01-decisions.md` | Decision register: confirmed direction, five proposals needing approval, and the Phase 0 engineering decisions | The owner. **Approval needed in Part B.** |
| `02-product-prd.md` | What Kids Mode is, scoped to v1 | Product, design |
| `03-architecture-and-data.md` | Routes, modules, data model, why not REST | Engineering |
| `04-safety-privacy-content.md` | Child safety, data protection, content sourcing | The owner, and whoever reviews legally |
| `05-delivery-roadmap.md` | Phases, gates, rollback, current status | Everyone |
| `06-adult-regression-checklist.md` | Manual walkthrough — the only regression safety net until real E2E tests exist | Whoever is about to merge a Kids Mode phase |

## Status

| Item | State |
|---|---|
| Architecture audit | Complete (`docs/architecture-audit.md`) |
| Kids Mode planning (docs) | Complete — **5 proposals in `01-decisions.md` Part B await approval** |
| **Phase 0 — engineering safeguards** | **✅ Complete.** Repository consolidated, backup tooling written, test framework running (121 tests), migration convention established, CI running, import-boundary lint rule active, adult regression checklist written. |
| Kids Mode implementation (Phase 1+) | **Not started — blocked on OD-1 through OD-4** |

## What must happen before Phase 1

Phase 0 (the engineering safety net) did not require legal or product decisions and is
done. **Phase 1 is the first phase that touches Kids Mode data**, and four decisions
gate it — listed in full in `05-delivery-roadmap.md` under "What's resolved, and what
still needs approval." Two of them (jurisdiction, video delivery) require review by
someone qualified in the relevant field, not by this team.

## Known limitations carried into Phase 1

Stated here so they aren't lost between documents:

- **The database backup has never been run for real.** The script and docs exist
  (`docs/backups.md`); the owner needs to run it once and confirm a real file comes out.
- **The RLS ownership test has never executed.** It's written against a real, existing
  table (`supabase/tests/database/rls_own_row.test.sql`) using the standard Supabase
  pgTAP pattern, but this environment has no Docker daemon to run `supabase test db`
  against. Treat the first real run as a verification, not a formality.
- **11 pre-existing lint errors**, none introduced by this work, are why CI's lint step
  is informational rather than blocking (`01-decisions.md` E-005).
