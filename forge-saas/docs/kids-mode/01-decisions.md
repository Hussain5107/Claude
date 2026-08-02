# 01 — Decision register

Two parts:

- **Part A — Confirmed direction.** Decisions carried from the audit. Listed so they can
  be challenged deliberately rather than drifted away from.
- **Part B — Proposals that differ from the audit.** Five places where I believe there
  is a better option *for this repository*. Each is recorded as **requiring approval**.
  The audit recommendation is stated alongside, not replaced.

**Nothing in Part B is adopted.** Until the owner approves, the audit recommendation
stands.

---

# Part A — Confirmed direction

| ID | Decision | Marker | Evidence |
|---|---|---|---|
| D-001 | One application, not a second app | **Verified** | Audit §16. Shared auth, shared engine, one deploy. Audit §2: 7 runtime dependencies, ~10.5k LOC — too small to justify a split. |
| D-002 | Children are parent-owned dependent records, not auth users | **Verified as recommendation / Open Decision as policy** | Audit §16, §24 Q3. Keeps every RLS policy at `auth.uid() = parent_user_id`. |
| D-003 | `/parent` and `/kids/*` are siblings of `/dashboard` | **Verified** | `src/app/dashboard/layout.tsx:34,39` injects theme + adult tab bar into all nested routes; `src/components/BottomTabBar.tsx:22` hardcodes five adult tabs. |
| D-004 | New tables; existing adult tables not widened | **Verified** | `supabase/schema.sql:54` (`programs.user_id` is a PK), `:85` (`progress` unique on `(user_id, log_date, exercise_slug)`). |
| D-005 | Kids domain logic in `src/lib/kids/*`, one-way imports | **Verified** | Audit §11, §17, §23. Rollback cleanliness depends on it. |
| D-006 | Share `ui.tsx` primitives; do not reuse adult screens or nav | **Verified** | `src/components/ui.tsx:3,12,26,35,44,53,58`. Audit §9: adult `*Client.tsx` files are 396–602 lines and mix concerns. |
| D-007 | Server Actions, not a REST API | **Verified** | Audit §8. Demonstrated in `03-architecture-and-data.md` §5 rather than asserted. |
| D-008 | Server-enforced feature flag via `entitlements.ts` | **Verified** | `src/lib/entitlements.ts:13,23,28`. |
| D-009 | No child-facing feature relies on client-side authorization or a UI PIN | **Verified** | Audit §5, §16. |
| D-010 | Never extend `progress_photos`, `health_metrics`, `cycle_*`, `personal_records`, `daily_intake` to children | **Verified** | Audit §19. Body photographs of minors are out of scope permanently, not deferred. |
| D-011 | No CMS in v1 | **Inferred** | Justified in `04-safety-privacy-content.md` §6 against v1 content volume and editorial need. Revisit trigger stated there. |

---

# Part B — Proposals requiring approval

Each proposal is scored on the seven axes requested: benefits, risks, complexity,
Adult Mode impact, privacy impact, testing impact, rollback impact.

---

## P-001 — Use a per-parent child index in URLs, not a raw UUID

**Status: Open Decision — requires approval**
**Audit recommendation:** `/kids/[childId]/...` with the child's UUID as the segment
(Audit §16).
**Proposal:** `/kids/[childIndex]/...` where `childIndex` is a small integer unique
*within one parent* (1, 2, 3…), never reused after deletion.

### Why this is better in this repository

The audit is right that the child id belongs in the URL rather than in a cookie or
context — the segment is what makes ownership checkable on every request. The
refinement is *which* identifier.

This is a children's product used on shared phones. URLs appear in browser history, in
screenshots parents send to each other, in the address bar over someone's shoulder, and
in any link pasted anywhere. A UUID in that position is a stable global identifier for a
specific child. An index is meaningless outside the parent's own session — `/kids/2`
identifies nobody.

It does not weaken authorization: the ownership lookup becomes "the child of
`auth.uid()` whose index is 2", which is *more* constrained than a UUID lookup, because
an index from another parent's URL resolves to your own child or to nothing. It cannot
resolve to someone else's.

| Axis | Assessment |
|---|---|
| **Benefits** | No stable child identifier leaks into history, screenshots or shared links. Ownership lookup is inherently parent-scoped. Shorter, friendlier URLs. |
| **Risks** | Index must be assigned server-side and never reused, or a deleted child's URL could resolve to a different child. Requires a uniqueness constraint on `(parent_user_id, child_index)`. |
| **Complexity** | Low. One extra column, one constraint, one resolver function. |
| **Adult Mode impact** | None. |
| **Privacy impact** | **Positive** — this is the entire point. |
| **Testing impact** | Neutral. Same ownership test, better assertion available: "another parent's URL resolves to my own child, never theirs." |
| **Rollback impact** | Neutral. Column dropped with the table. |

**Open sub-question:** index reuse policy after deletion. Recommend never reusing.

---

## P-002 — Derive XP from activity in v1; do not store a rewards ledger

**Status: Open Decision — requires approval**
**Audit recommendation:** a `child_rewards` table holding an XP ledger and earned badges
(Audit §19).
**Proposal:** for v1, store only `child_activity`, and compute XP, level and badges from
it with a pure function. Add the ledger later, if and when it is needed.

### Why this is better in this repository

The audit's ledger is the right long-term shape, but it introduces a second source of
truth for a number that is fully determined by the first. Two sources drift. A failed
write after a completed session produces a child who did the work and lost the points —
the worst possible bug in a motivation feature aimed at children.

Deriving keeps one source of truth. The repository already prefers this: `streaks` is
maintained separately, but the *progress charts* are computed from `workout_sets` on
read (`src/app/dashboard/progress/page.tsx`), not stored. XP is a pure function in the
same family as `src/lib/progression.ts` and `src/lib/tracking.ts`.

**When the ledger becomes necessary** — and it should then be added deliberately:

1. XP is awarded for something that is not an activity row (a manual parent bonus).
2. The XP formula changes and historical totals must not move.
3. Recomputation becomes expensive — not plausible at this scale.

| Axis | Assessment |
|---|---|
| **Benefits** | One source of truth; no drift; no partial-write class of bug. One fewer table in v1. XP rules become a pure, unit-testable function. |
| **Risks** | Changing the formula silently changes historical XP. A child may notice their total moved. Mitigate by treating the formula as versioned and only changing it deliberately. |
| **Complexity** | **Lower** than the audit option. |
| **Adult Mode impact** | None. |
| **Privacy impact** | **Positive** — strictly less data stored about a child. |
| **Testing impact** | **Positive** — a pure function is the easiest thing to test in a repo with no test suite (Audit §12 R1). |
| **Rollback impact** | **Positive** — one fewer table to drop. |

---

## P-003 — v1 ships curated fixed sessions, not a generated program

**Status: Open Decision — requires approval**
**Audit recommendation:** `src/lib/kids/generator.ts` as a sibling of the adult
generator, persisting to a `child_programs` table (Audit §17, §19).
**Proposal:** v1 selects from a small set of hand-authored, age-banded sessions. No
generator, no `child_programs` table, no JSONB program shape.

### Why this is better in this repository

The adult generator exists because adults have goals, experience levels, equipment
tiers and frequencies that multiply into hundreds of combinations (Audit §11). Children
in v1 have one axis that matters — age band — and the sessions should be reviewed by a
qualified person anyway (`04-safety-privacy-content.md` §3). If a human is signing off
the output, generating it first adds a step that produces something a human then has to
check.

This also removes a versioning liability. `programs.program` is live JSONB read
defensively (`program.daysPerWeek ?? 6`, `src/components/DashboardClient.tsx`), and
Audit §15.7 flags that shape as untouchable. Shipping a *second* persisted JSONB shape
in v1 creates the same constraint for kids before we know what the shape should be.

The generator remains the right answer for v2, once real usage shows what varies.

| Axis | Assessment |
|---|---|
| **Benefits** | One fewer table, no persisted JSONB shape to be stuck with, faster to ship, and every session is a reviewed artifact rather than a generated one. |
| **Risks** | Less personalisation; a child could find it repetitive. Mitigate with enough authored variety per band. Migrating to a generator later means writing the table then, not never. |
| **Complexity** | **Substantially lower.** Removes a module and a table from v1. |
| **Adult Mode impact** | None either way. |
| **Privacy impact** | Neutral. |
| **Testing impact** | **Positive** — no generator to test; content is data, checked by type and by review. |
| **Rollback impact** | **Positive** — fewer tables. |

**Trade-off to state plainly:** this makes v1 less impressive as a feature. If the goal
is to demonstrate personalisation, the audit's option is the better one. Decide against
the goal, not the effort.

---

## P-004 — Require a verified email to enrol in Kids Mode, not app-wide

**Status: Open Decision — requires approval**
**Audit position:** email verification is currently off, and a guardianship claim from
an unverified address is weak (Audit §5, §24 Q4) — but it is raised as an app-wide
question.
**Proposal:** leave adult signup exactly as it is; require a verified email at the point
a parent creates their first child profile.

### Why this is better in this repository

Turning verification on app-wide changes adult onboarding, which P1 forbids without
strong cause, and would add friction to a flow that works. But the guardianship claim is
specific to Kids Mode: it is the moment someone asserts a relationship to a minor.

Gating at enrolment puts the check exactly where the claim is made. It is also
reversible in one place, and it does not touch a single adult file.

**Repository caveat, stated honestly:** verification email delivery was disabled during
development because the Resend sandbox sender only delivers to the account owner's own
address. Enabling this needs a working sender domain first. That is an infrastructure
prerequisite, not a code change, and it is listed as such in the roadmap.

| Axis | Assessment |
|---|---|
| **Benefits** | The check sits where the claim is made. Zero adult-flow change. Reversible in one place. |
| **Risks** | Friction at enrolment; some parents will drop out. Requires a working transactional email sender. |
| **Complexity** | Low — one server-side check in the enrolment action. |
| **Adult Mode impact** | **None**, versus "changes signup for everyone" if applied app-wide. |
| **Privacy impact** | Positive. |
| **Testing impact** | One case: unverified caller is rejected server-side. |
| **Rollback impact** | Trivial — remove the check. |

**This is not a compliance determination.** Whether verified email constitutes adequate
parental consent in any jurisdiction is a legal question, not an engineering one. See
`04-safety-privacy-content.md` §2.

---

## P-005 — Make an RLS ownership test the first test written

**Status: Open Decision — requires approval**
**Audit recommendation:** Phase 0 adds a test runner and covers the pure engine modules
(Audit "Implementation roadmap", Phase 0).
**Proposal:** keep that, and add one thing ahead of it — an integration test that proves
a parent cannot read or write another parent's child.

### Why this is better in this repository

The audit's Phase 0 targets the right modules for the right reason: the generator gains
a second consumer. But it optimises for *correctness of output*, and the highest-severity
failure in a children's feature is not a wrong rep count — it is one family seeing
another family's child.

RLS is the entire authorization model (Audit §5: no roles, 41 own-row policies), and
there is currently **zero automated verification that any of those 41 policies works.**
They are believed correct because they were written carefully. For adult data that is a
tolerable risk. For children's data it is worth one test that actually attempts the
cross-account read and asserts it fails.

This is an addition to the audit's plan, not a replacement.

| Axis | Assessment |
|---|---|
| **Benefits** | Verifies the one control that matters most. Establishes a harness that can later cover the existing 41 adult policies. |
| **Risks** | Needs a test database and two seeded accounts — the first real test infrastructure this project has had. |
| **Complexity** | Moderate; higher than a unit test. This is the honest cost. |
| **Adult Mode impact** | None. Optionally positive later, if the harness is extended to adult policies. |
| **Privacy impact** | Positive. |
| **Testing impact** | This *is* the testing impact. |
| **Rollback impact** | None. |

---

# Open decisions requiring owner approval

Grouped by what they block. **Nothing in Phase 0 starts until the first group is
resolved.**

### Blocking Phase 0

| ID | Question | Who decides | Blocks |
|---|---|---|---|
| **OD-1** | Which jurisdictions do we serve, and what is the minimum age? | **Qualified legal review** — not this team | The entire data model |
| **OD-2** | Can YouTube be embedded on a child-facing screen, and who owns ongoing video review? | Owner, informed by provider policy review | Content pipeline, `04` §4 |
| **OD-3** | Confirm D-002: children are dependent records, not auth users | Owner | Every table in `03` |
| **OD-4** | Is a working transactional email sender available? (prerequisite for P-004) | Owner | Enrolment design |

### Blocking Phase 1

| ID | Question | Who decides |
|---|---|---|
| **OD-5** | Approve or reject P-001 (child index in URLs) | Owner |
| **OD-6** | Approve or reject P-005 (RLS test first) | Owner |
| **OD-7** | One repository or two? Audit §12 R3 — the same app currently lives in `Hussain5107/Claude` and `Hussain5107/forge-saas` with divergent history | Owner |
| **OD-8** | Will a manual database backup be taken before the first kids migration? Audit §12 R4 — the free tier has none | Owner |

### Blocking Phase 3

| ID | Question | Who decides |
|---|---|---|
| **OD-9** | Approve or reject P-003 (curated sessions vs generator) | Owner |
| **OD-10** | Age range and number of bands | Owner + youth-fitness review |
| **OD-11** | Who is qualified to sign off child exercise safety? | Owner — **must be a named person** |

### Blocking Phase 5

| ID | Question | Who decides |
|---|---|---|
| **OD-12** | Approve or reject P-002 (derive XP vs ledger) | Owner |
| **OD-13** | Is a child ever told they lost a streak? Daily XP cap? | Owner, see `02` §6 |
| **OD-14** | What does the parent see — all activity, or a weekly summary? | Owner, see `02` §5 |
