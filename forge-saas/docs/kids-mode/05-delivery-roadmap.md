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

**Entry gate:** OD-1 through OD-4 answered. OD-7 and OD-8 decided.
**User-visible change:** none.

| # | Task | Why | Evidence |
|---|---|---|---|
| 0.1 | **Consolidate to one repository** | The same app is in `Hussain5107/Claude` and `Hussain5107/forge-saas` with divergent history. This already cost several hours of "why isn't my change deploying". | Audit §12 R3 |
| 0.2 | **Take a manual database backup** | The free tier has none. Production is the only copy of every user's history, and Phase 1 adds tables to it. | Audit §12 R4 |
| 0.3 | Establish `supabase/migrations/` for new work; leave the existing 18 sections alone | No record exists of what production has applied. Retro-fitting risks breaking a working database for no user benefit. | Audit §21 |
| 0.4 | **Add a test runner and write the ownership test first** | P-005. RLS is the entire authorization model and none of the 41 policies is verified today. | Audit §5, §12 R1 |
| 0.5 | Cover the pure adult engine modules | They gain a second consumer — **weaker if P-003 is approved, since then there is no kids generator, but still worth doing.** | Audit roadmap Phase 0 |
| 0.6 | Add the `no-restricted-imports` lint rule from `03` §1 | Makes the rollback guarantee enforced rather than remembered | Audit §23 |

**Difference from the audit, stated openly:** the audit orders Phase 0 as "tests for the
engine". P-005 argues the ownership test comes first. Both are in 0.4/0.5; the ordering
is the proposal. **Requires OD-6.**

---

## Phase 1 — Foundations (dark)

**Entry gate:** Phase 0 complete. OD-5 decided (URL identifier form).
**User-visible change:** none. Flag closed.

| # | Task |
|---|---|
| 1.1 | `kids_mode` in `AVAILABLE_ON`, set to `[]` — available to nobody |
| 1.2 | Per-profile opt-in column for allow-list rollout |
| 1.3 | `child_profiles` table + RLS, all four verbs (`03` §4) |
| 1.4 | `src/lib/kids/types.ts` |
| 1.5 | `kidsServer.ts` ownership resolution |
| 1.6 | The ownership test from 0.4 now runs against real tables |

**Exit criteria:** flag closed means routes are unreachable by direct URL; ownership test
passes; adult app verifiably unchanged.

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

## What must be approved before Phase 0 engineering safeguards

**This is the answer to "what do you need from me".**

### Blocking — Phase 0 cannot start

| ID | Needs | From |
|---|---|---|
| OD-1 | Jurisdictions, minimum age, consent adequacy, retention | **Qualified legal review** |
| OD-2 | Video delivery decision + named review owner | Owner, after provider-terms review |
| OD-3 | Confirm children are dependent records, not auth users | Owner |
| OD-4 | Confirm a working transactional email sender | Owner |
| OD-7 | One repository or two | Owner |
| OD-8 | Manual database backup before any kids migration | Owner |
| OD-6 | Approve or reject P-005 (ownership test first) | Owner |

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
