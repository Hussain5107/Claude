# 05 — Delivery roadmap

Phases with **entry gates**. A phase does not start until its gate is satisfied. This
follows the audit's roadmap, with two differences flagged where they occur.

---

## Gate 0 — Before any engineering

**Nothing starts until all four are answered.** Verified: Audit §24 places these before
any schema is written; Audit §12 R2 rates the compliance question High.

| ID | Question | Owner | Consequence if skipped |
|---|---|---|---|
| **OD-1** | Jurisdictions and minimum age | **Qualified legal review** | `child_profiles` fields are guesses; changing them later means migrating children's data |
| **OD-2** | Video delivery, and who owns ongoing review | Owner, after provider-terms review | Content pipeline undefined; may remove video from v1 entirely |
| **OD-3** | Confirm children are dependent records, not auth users | Owner | Every table in `03` §4 changes |
| **OD-4** | Is a working transactional email sender available? | Owner | P-004 cannot ship. **Repository fact:** verification was disabled because the Resend sandbox sender only delivers to the account owner's own address (Audit §5). |

---

## Phase 0 — Engineering safeguards

**STATUS: COMPLETE.** See the completion report delivered alongside this update for
full detail; summarised here.

> **Documentation correction, stated openly.** This section previously gated Phase 0
> on OD-1 through OD-4, OD-7 and OD-8 being answered by the owner first. That was
> wrong, and it was corrected rather than quietly followed: those four are Kids
> Mode *data and content* decisions (jurisdiction, video, the auth model, email
> verification), and nothing in the actual Phase 0 task list below touches
> children's data, routes, or content — the owner's Phase 0 instructions explicitly
> exclude all of that. Gating pure engineering safeguards on legal review of a
> feature that doesn't exist yet was an error in the earlier draft of this
> document, not a real dependency. The correct gate, per those instructions, was
> "no material blocker" — none was found, so Phase 0 proceeded. **OD-1 through
> OD-4 still gate Phase 1 and beyond**, where children's data actually starts
> being designed.

**User-visible change:** none. Verified against the head commit that closed the
four owner gates below — CI green on canonical, and the full Adult Mode regression
suite executed against a real local Supabase stack (11 specs, all passing).

| # | Task | Status | Evidence |
|---|---|---|---|
| 0.1 | Consolidate to one repository | ✅ Done (previous session) | `docs/repository.md`, Audit §12 R3 |
| 0.2 | Manual database backup procedure | ✅ Script + docs; ✅ rehearsed end-to-end (dump + restore + verify) against real Postgres 16 with synthetic data — two real gotchas surfaced and documented (`drop schema public cascade;` before restoring, `--no-privileges` strips grants) | `docs/backups.md`, Audit §12 R4 |
| 0.3 | `supabase/migrations/` for new work | ✅ Done | `supabase/migrations/README.md`, decision E-003 |
| 0.4 | Test runner + ownership test strategy | ✅ Framework + 121 unit tests running; ✅ RLS ownership test **executed on a real Supabase local stack (`supabase test db`, all 6 assertions pass)**, via `.github/workflows/db-tests.yml` on GitHub Actions | decisions E-001, E-004, E-010, E-011, E-012 |
| 0.5 | Cover the pure adult engine modules | ✅ `generator`, `splits`, `dayRotation`, `progression`, `tracking`, `entitlements`, `cycle`, `cycleAdaptation` — 121 tests, all passing | `01-decisions.md` E-001 |
| 0.6 | `no-restricted-imports` lint rule | ✅ Done — engages the moment `src/lib/kids` or `src/components/kids` exist; zero effect today (confirmed: lint error count unchanged) | `eslint.config.mjs` |
| 0.7 *(new)* | CI: lint + typecheck + test on push/PR | ✅ Done, canonical repo only | `.github/workflows/ci.yml`, decisions E-005, E-006 |
| 0.8 *(new)* | Adult Mode regression checklist | ✅ Written **and driven end-to-end** — one Playwright spec covering signup, sex-dependent cycle question, onboarding, five-tab bar, workouts, display name, theme switching across tabs, log out landing on 200 (the 405 bug's regression test), post-logout redirect. All 11 assertions passing against real local Supabase. | `06-adult-regression-checklist.md`, `e2e/adult-regression.spec.ts`, decisions E-009, E-010, E-013, E-014, E-015, E-016 |

**Ordering note, resolved:** P-005 (ownership test before engine tests) was folded
in rather than sequenced — both were written in the same phase, so the "which
first" question in the original roadmap draft is moot. **OD-6 (approve/reject
P-005) is still open** as a matter of record, since the engine tests were also
written regardless of its outcome.

### Owner's four closing verification gates — all closed

Recorded here as the exit criteria for Phase 0, per the owner's Aug 2 2026 instruction.

| Gate | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Successful CI run URL on canonical | ✅ | `.github/workflows/ci.yml` green; `db-tests.yml` run #8 green: https://github.com/Hussain5107/forge-saas/actions/runs/30760575102 |
| 2 | Backup + non-production restore rehearsed, no secrets exposed | ✅ | Rehearsed against local Postgres 16 with synthetic data only; findings documented in `docs/backups.md` (schema-collision + grants) |
| 3 | `supabase test db` executed in an environment with Docker | ✅ | `db-tests.yml` on GitHub Actions runners (this session's sandbox blocks container registries — see E-004). All 6 pgTAP assertions pass. Three real bugs surfaced and fixed along the way — see E-010, E-011, E-012 |
| 4 | Adult Mode regression checklist completed with pass/fail | ✅ | Playwright suite `e2e/adult-regression.spec.ts` in `db-tests.yml` run #8: 11 passed / 0 failed. Three real test-harness bugs surfaced and fixed along the way — see E-013, E-015, E-016. **Every failure was in the tests, never in Adult Mode itself.** |

**Human-only items remaining in the checklist** (`06-adult-regression-checklist.md`
"what this doesn't catch"): gym geolocation, photo upload, PWA install prompts, voice
audio. Scripting these would produce a false pass; they need a real device or a real
person. The owner runs them before flipping the entitlement in Phase 8.

---

## Phase 1 — Foundations (dark)

**STATUS: BUILT, verification in progress.** See `01-decisions.md` E-017 for the full
account, including a corrected merge against an external draft.

**Scope note.** This phase now bundles what an earlier draft of this document split
across Phase 1 and Phase 2 (the `/parent` surface, child CRUD, and the parent PIN gate),
per the owner's newer, more detailed Phase 1 brief — see `01-decisions.md` E-017's
closing section for why. It is a superset of the original Phase 1, not a contradiction
of it: every task below still holds, plus more.

**Entry gate:** Phase 0 complete. OD-5 decided — resolved as P-001, `/kids/[index]`
(index 1-5, per-parent, never reused). See E-017.
**User-visible change:** none. Flag closed — `AVAILABLE_ON.kids_mode` is `[]`, so
`/parent` and `/kids/[child]` 404 for every account regardless of the new
`profiles.kids_mode_enabled` column's value.

| # | Task | Status | Evidence |
|---|---|---|---|
| 1.1 | `kids_mode` in `AVAILABLE_ON`, set to `[]` — available to nobody | ✅ | `src/lib/entitlements.ts` |
| 1.2 | Per-profile opt-in column for allow-list rollout | ✅ | `profiles.kids_mode_enabled`, migration `202608030357_kids_mode_foundation.sql`; `hasKidsModeAccess()` requires both layers |
| 1.3 | `child_profiles` table + RLS, all four verbs (`03` §4) | ✅ | Same migration; `parent_pins` table also added (PIN gate, P2 — UX only) |
| 1.4 | `src/lib/kids/types.ts` | ✅ | Plus `avatars.ts`; unit-tested |
| 1.5 | `kidsServer.ts` ownership resolution | ✅ | `resolveChildByIndex`, `requireParentAccess`, full child CRUD |
| 1.6 | The ownership test from 0.4 now runs against real tables | ⏳ | `supabase/tests/database/rls_child_profiles.test.sql` written, copied from `rls_own_row.test.sql` per that file's own instruction; not yet executed against a real Supabase local stack (needs the GitHub Actions run — see below) |
| 1.7 *(new)* | `/parent` route: layout (auth+flag), PIN-gated dashboard, child CRUD UI, PIN setup/change/remove | ✅ | `src/app/parent/**` |
| 1.8 *(new)* | `/kids/[child]` route: layout (auth+flag+ownership), stub home | ✅ | `src/app/kids/[child]/**` — real content is Phase 2 |
| 1.9 *(new)* | Kids design tokens + one UI primitive | ✅ | `src/styles/kids-tokens.css` (imported only from the kids layout, not globally), `KidsButton`, `KidsExitLink` |
| 1.10 *(new)* | Flag-closed regression proof | ⏳ | Two new Playwright specs in `e2e/adult-regression.spec.ts` asserting `/parent` and `/kids/1` 404 for a real signed-in account; not yet run for real |

**Exit criteria:** flag closed means routes are unreachable by direct URL (built, not yet
proven by a real CI run); ownership test passes (written, not yet run); adult app
verifiably unchanged (typecheck, build, lint, and all 135 unit tests pass locally — the
Playwright Adult regression suite re-run, including the two new flag-closed checks, is
the remaining real-environment proof, same as every other Postgres-backed check this
project has done).

---

## Phase 2 — Parent surface

**Entry gate:** Phase 1 complete.

| # | Task |
|---|---|
| 2.1 | `/parent` route group, own layout and nav (not `BottomTabBar` — D-006) |
| 2.2 | Create / edit / delete child |
| 2.3 | **Prove the deletion cascade before anything is built on top of it** |
| 2.4 | Enrolment gated on verified email (P-004, if OD-4 allows) |

**Why deletion comes before features:** every later phase adds tables that must cascade.
Proving it with one table is far cheaper than discovering a gap with four.

---

## Phase 3 — Kids content

**Entry gate:** OD-9 (curated vs generated), OD-10 (age bands), **OD-11 (a named
qualified reviewer)**.

| # | Task |
|---|---|
| 3.1 | Kids exercise/session library as a typed data module (`04` §6 — no CMS) |
| 3.2 | Age-band selection logic — pure, testable |
| 3.3 | **Qualified review sign-off before any of it reaches a child** |
| 3.4 | Imagery, slug-named in `public/images` as the adult library does |

**If P-003 is approved:** no generator, no `child_programs` table. **If rejected:** add
`src/lib/kids/generator.ts` as a sibling and the table, per Audit §17/§19.

**3.3 is a hard gate, not a review step.** No child-facing content ships without it.

---

## Phase 4 — Kids experience

**Entry gate:** Phase 3 signed off.

| # | Task |
|---|---|
| 4.1 | `/kids/[child]` shell — own nav, kids theme via `[data-theme]` |
| 4.2 | Child home screen |
| 4.3 | Session screen |
| 4.4 | `child_activity` + completion action, **server-computed** |
| 4.5 | Adult entry-point link, flag-gated — **the only adult-side edit** (`03` §6) |

---

## Phase 5 — Motivation

**Entry gate:** OD-12 (derive vs ledger), OD-13 (streak and cap policy).

| # | Task |
|---|---|
| 5.1 | Reward rules as a pure function (`src/lib/kids/rewards.ts`) |
| 5.2 | XP / level / badges — **server-computed from what actually happened**. A client-supplied XP amount is a cheat code. |
| 5.3 | Daily cap (OD-13) |
| 5.4 | `child_rewards` **only if P-002 rejected** |

---

## Phase 6 — Video

**Entry gate:** OD-2 resolved **and** a named owner for ongoing review.

| # | Task |
|---|---|
| 6.1 | Curated allow-list (`src/lib/kids/videos.ts`) |
| 6.2 | Player per the OD-2 decision |
| 6.3 | Review cadence, with the owner named in writing |

**If OD-2 cannot be resolved cleanly, skip this phase.** Video is not load-bearing for
v1 (`04` §4).

---

## Phase 7 — Parent dashboard

**Entry gate:** OD-14 (all activity vs weekly summary).

| # | Task |
|---|---|
| 7.1 | Aggregate view, following the `review_stats` pattern (`supabase/schema.sql:393`) |
| 7.2 | Summary screen per OD-14 |

---

## Phase 8 — Rollout

| # | Task |
|---|---|
| 8.1 | Enable for the owner's own account only |
| 8.2 | Walk every adult flow with the flag on — **the only regression check available** (Audit §12 R1) |
| 8.3 | Enable for a handful of trusted parents |
| 8.4 | Watch |
| 8.5 | Only then, open the entitlement more widely |

---

## Rollback at every phase

**Verified.** Audit §23.

| Phase reached | Rollback |
|---|---|
| 1–3 | Nothing user-visible shipped. Drop tables, delete files. |
| 4–7 | `kids_mode: []` — instant, no deploy. Then delete files and tables at leisure. |
| 8 | Same. Plus revert the one adult-side link. |

Clean rollback depends entirely on the import rule in `03` §1 holding — hence task 0.6.

---

## What's resolved, and what still needs approval

**Phase 0 is complete. This is the answer to "what do you need from me" to start
Phase 1** — the first phase that actually touches Kids Mode data.

### Resolved

| ID | Was | Now |
|---|---|---|
| OD-7 | One repository or two | **Done.** `Hussain5107/forge-saas` is canonical (`docs/repository.md`). |
| OD-8 | Backup before any kids migration | **Done.** Tooling written (`scripts/backup-db.sh`, `docs/backups.md`) AND rehearsed end-to-end against a real Postgres 16 with synthetic data — dump, restore into a separate database, row-for-row verification. Findings incorporated into `docs/backups.md`. |
| OD-6 | Approve or reject P-005 (ownership test first) | **Written regardless** — both the ownership test and the engine tests shipped in the same phase, so the sequencing question is moot. Formal approve/reject of the *proposal itself* (as a precedent for future phases) is still open, but nothing is blocked on it. |

### Blocking Phase 1 — the first phase touching Kids Mode data

| ID | Needs | From |
|---|---|---|
| OD-1 | Jurisdictions, minimum age, consent adequacy, retention | **Qualified legal review** |
| OD-2 | Video delivery decision + named review owner | Owner, after provider-terms review |
| OD-3 | Confirm children are dependent records, not auth users | Owner |
| OD-4 | Confirm a working transactional email sender | Owner |

### Blocking later phases, but decide early if convenient

| ID | Needs | Blocks |
|---|---|---|
| OD-5 | Approve or reject P-001 (child index in URLs) | Phase 1 |
| OD-9 | Approve or reject P-003 (curated vs generated) | Phase 3 |
| OD-10 | Age range and bands | Phase 3 |
| OD-11 | **Name** the qualified exercise reviewer | Phase 3 |
| OD-12 | Approve or reject P-002 (derive XP vs ledger) | Phase 5 |
| OD-13 | Streak and daily-cap policy | Phase 5 |
| OD-14 | Parent sees all activity, or a weekly summary | Phase 7 |

**Two of these cannot be answered by this team at all:** OD-1 needs legal review, OD-11
needs a qualified youth-fitness reviewer. Everything else is the owner's call.
