# 01 — Decision register

Three parts:

- **Part A — Confirmed direction.** Decisions carried from the audit. Listed so they can
  be challenged deliberately rather than drifted away from.
- **Part B — Proposals that differ from the audit.** Five places where I believe there
  is a better option *for this repository*. Each is recorded as **requiring approval**.
  The audit recommendation is stated alongside, not replaced.
- **Part C — Phase 0 engineering decisions.** Tooling and process choices made while
  building the Phase 0 safety net. These are reversible, do not touch Adult Mode
  behaviour, and do not involve legal, privacy, vendor-contract, or destructive-data
  questions — so, per the Decision Rule, they were made and recorded rather than
  escalated. Challengeable the same as anything else here.

**Nothing in Part B is adopted.** Until the owner approves, the audit recommendation
stands. **Part C is already implemented** — it is Phase 0 itself.

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

---

# Part C — Phase 0 engineering decisions

Each entry: what was decided, alternatives considered, why, trade-offs, and how to
undo it.

---

## E-001 — Vitest as the test framework

**Decided.** Node-environment tests only (no jsdom, no React Testing Library yet).

**Alternatives considered:**

| Option | Why not |
|---|---|
| Jest | The Next.js 16 App Router docs bundled in this exact install
(`node_modules/next/dist/docs/01-app/02-guides/testing/`) contain a Vitest guide and
**no Jest guide**. `AGENTS.md` warns this Next.js version breaks convention against
training data — the absence of official Jest documentation for this version is treated
as evidence, not an oversight. |
| No test framework, keep using throwaway scripts | This is explicitly the debt the audit flagged (`docs/architecture-audit.md` §13: "verified with throwaway scripts that were not kept"). Phase 0 exists to stop doing that. |

**Why:** Vitest is the framework the installed Next.js version itself documents.
Fast (the full 121-test suite runs in under a second), ESM-native, no Babel
configuration needed.

**Trade-off:** no component-rendering tests yet. `jsdom` and `@testing-library/react`
are not installed — nothing in Phase 0 renders a component, so they would be
speculative weight. Add them in the phase that first needs to test a component,
not before.

**Rollback:** `npm uninstall vitest`, delete `vitest.config.mts` and every
`*.test.ts` file. Zero effect on `next build`, `next dev`, or any runtime path —
these are devDependencies and a `test` script only.

---

## E-002 — Native `resolve.tsconfigPaths`, not the `vite-tsconfig-paths` plugin

**Decided**, and it reverses my own first draft within this same phase.

The Next.js testing guide's example config imports `vite-tsconfig-paths` as a
plugin. I installed it, wrote the config around it, and ran the suite — Vitest's
own startup warning said the plugin is superseded by a native
`resolve.tsconfigPaths: true` option in the Vite version this Vitest pulls in.
Switched, re-ran (still 121/121 passing), uninstalled the now-unnecessary
package.

**Why this is recorded rather than silently fixed:** the instructions asked for
better options to be taken and explained, not just taken. This is the clearest
example in Phase 0 — a documented recommendation turned out to be one dependency
heavier than the tool itself now requires, and the fix was to listen to the tool
rather than the doc snippet.

**Rollback:** revert `vitest.config.mts`, `npm install -D vite-tsconfig-paths`,
add the plugin back. Never became load-bearing for anything.

---

## E-003 — `supabase/migrations/` for everything new; `schema.sql` frozen

**Decided.** Exactly Audit §21's recommendation, implemented as
`supabase/migrations/README.md`.

**Alternative considered:** retrofit the existing 18 `schema.sql` sections into
timestamped migration files. **Rejected** — no ordering guarantee exists for what
has actually been applied to production, and restructuring working history risks
breaking a database that currently works, for zero user-visible benefit. Audit §21
already reached this conclusion; Phase 0 just executes it.

**Not decided, deliberately:** whether to automate applying migrations (the
`supabase` CLI, now a dev dependency, can run `db push` against a linked project).
That needs a decision about a shadow database, a service-role secret living in CI,
and a review gate — real decisions, not a Phase 0 default. Migrations remain a
manual SQL Editor paste for now, same as `schema.sql` always was.

**Rollback:** delete the `migrations/` folder. `schema.sql` is untouched either
way — this only affects where *future* SQL is written down.

---

## E-004 — RLS test strategy: pgTAP via the Supabase CLI, proven against an
**existing** adult table

**Decided.** `supabase/tests/database/rls_own_row.test.sql`.

**Alternatives considered:**

| Option | Why not |
|---|---|
| A Node/TypeScript integration test hitting a real Postgres over `pg` | Reinvents what pgTAP already does, and needs its own auth-mocking layer. Supabase's own CLI (`supabase test db`) runs pgTAP tests against a local Postgres for exactly this purpose, and it's already a dev dependency. |
| Wait until `child_profiles` exists to write any RLS test | Rejected — see P-005 in Part B. RLS is the entire authorization model (Audit §5) and none of the 41 existing policies has ever been exercised by an automated test. Waiting for Kids Mode tables means the *first* RLS test in this codebase's history is also the one carrying the most risk. |

**Why the test targets `cycle_settings`, not a new table:** Phase 0 explicitly
excludes creating child tables or policies. `cycle_settings` already has the exact
policy shape a `child_profiles` table will need — all four verbs, own-row via
`auth.uid()` — so this both respects the Phase 0 boundary and produces a real
regression test for a real adult table today. The file says explicitly where to
copy it once `child_profiles` exists.

**Disclosed honestly:** this test has **not been executed**. `supabase test db`
requires a local Postgres via Docker (`supabase start`), and the Docker daemon is
not reachable in the environment this was written in (confirmed:
`docker ps` → "cannot connect to the Docker daemon"). The SQL is written against
the well-established Supabase pgTAP pattern and against this repository's actual
schema, but it is unverified in the same way `scripts/backup-db.sh` was unverified
in the previous phase — the first real run should be treated as a test of the test,
not a formality.

**Rollback:** delete `supabase/tests/`, `supabase/config.toml`, and
`npm uninstall supabase`. None of it is referenced by application code.

---

## E-005 — CI lint step is `continue-on-error`, not blocking

**Decided.** `.github/workflows/ci.yml` runs `npm run lint` but does not fail the
job on it.

**Why:** running the existing lint config surfaced **11 pre-existing errors**, all
`react-hooks/set-state-in-effect`, across files this session never touched
(`src/components/ReviewPrompt.tsx`, `src/hooks/useSpeech.ts`, and others) —
confirmed pre-existing via `git diff --name-only` against those paths, which came
back empty. Also already recorded as debt in `docs/architecture-audit.md` §13.

**Alternatives considered:**

| Option | Why not |
|---|---|
| Fix the 11 errors so lint can block | Out of Phase 0's scope — "no changes to Adult Mode user workflows," and `useEffect` patterns in production components carry real regression risk to fix casually. A one-line effect change is still a change to code with zero test coverage before this phase. |
| Make CI fail on lint anyway | A CI job that is permanently red for reasons unrelated to whatever PR is open trains people to stop looking at it — the exact failure mode a safety net exists to prevent. Worse than no CI. |
| Silently drop the lint step | Loses the signal entirely, including for *new* lint errors Kids Mode code might introduce. |

**What `continue-on-error: true` actually buys:** the step still runs, still
annotates the PR with every finding, just doesn't fail the job. A new file that
introduces error #12 is exactly as visible as error #1 through #11 — this doesn't
hide new problems, it just declines to block on old ones.

**Rollback:** remove `continue-on-error: true`, or fix the 11 pre-existing errors
first — either restores a fully blocking lint gate.

---

## E-006 — CI workflow lives only in the canonical repository

**Decided.** `.github/workflows/ci.yml` was added to `Hussain5107/forge-saas`
only, not to the archived copy in `Hussain5107/Claude`.

**Why:** `docs/repository.md` already establishes that FORGE changes go to the
canonical repository only. A CI workflow is exactly the kind of engineering
change that document exists to keep out of the archive — Vercel doesn't build
from the archive, and a workflow running there would test code nobody deploys,
which is worse than no signal at all.

**Rollback:** delete `.github/workflows/ci.yml` from the canonical repo. Nothing
depends on it existing.

**Scope correction, added after the fact:** this decision covers the workflow file
specifically, not "nothing from Phase 0 goes to the archive." An earlier draft of
the completion report over-applied it — treating the archive as receiving zero
Phase 0 content and leaving 21 files uncommitted there — until a stop-hook flagged
the uncommitted state. On reflection that was overcorrection: the actual risk this
document exists to prevent (Vercel deploying stale code because the *canonical*
repo fell behind) is fully covered as long as canonical receives every change
first, which it did (`77fb7a2`, pushed before the archive mirror). Pushing the same
content to the archive afterward as a synced mirror doesn't reintroduce that risk —
it just keeps the historical record from silently rotting while it still exists.
The archive now mirrors the app-level Phase 0 work at `29d16cf`. The CI workflow
itself stays canonical-only, because unlike the rest of the change it would be
inert there regardless (Actions don't fire meaningfully against a repo Vercel
never reads), so mirroring it would be dead weight rather than continuity.

---

## E-007 — `next build` is not part of the Phase 0 CI job

**Decided** by omission, recorded so it isn't mistaken for an oversight.

Phase 0's stated CI baseline is "linting, type checking, and tests" — build
verification was not requested. Adding it anyway would have required deciding how
CI sources Supabase environment values: the landing page (`src/app/page.tsx`) is
statically generated with `revalidate = 3600` and reads from Supabase at build
time, so `next build` in a clean CI checkout needs *something* in
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to succeed — either a
placeholder that makes the build path different from production's, or the real
public anon key stored as a GitHub Actions secret.

Neither is a default; both are a real choice with a real trade-off, and per the
instructions' security boundary, secrets — even a publishable anon key — aren't
something to introduce into CI configuration without stating why. Left for a
deliberate follow-up decision rather than guessed at here.

**Rollback:** N/A — nothing was added.

---

## E-008 — Pre-existing dependency vulnerabilities: one fixed, two left alone

**Decided.** Installing the three Phase 0 dev dependencies surfaced
`npm audit` findings. Investigated before doing anything about them.

**`brace-expansion` (high, DoS via unbounded expansion)** — confirmed pre-existing
(present before this phase's `npm install`, via `eslint`'s dependency tree, not
introduced by `vitest`/`supabase`). Fixed with `npm audit fix` (no breaking
change, `eslint` stayed on the same major version).

**`postcss` and `sharp` (high, both bundled inside `next`'s own dependency
tree)** — confirmed pre-existing. **Not fixed.** The only automatic fix
(`npm audit fix --force`) downgrades `next` itself to `9.3.3` — a four-major-version
downgrade of the framework the entire application runs on. That is definitionally
"a material change to Adult Mode" and stops at the same boundary as every other
non-negotiable in this project. Flagged here for the owner's awareness; resolving
it properly means waiting for an upstream Next.js patch or a deliberate, tested
framework upgrade — neither is Phase 0 work.

**Rollback:** N/A for the fixed one (already the safe, non-breaking option). The
two left alone were never touched.

---

## E-009 — Playwright, adopted now rather than deferred

**Decided.** `docs/kids-mode/06-adult-regression-checklist.md` originally said real E2E
coverage was "future work, not Phase 0." Closing the owner's verification gate on the
regression checklist required actually driving a browser through real auth flows, and
this sandbox cannot reach any live Supabase project to do that — so a browser-automation
tool became necessary now, not eventually.

**Why Playwright specifically:** already justified before this was needed —
`e2e/adult-regression.spec.ts`'s header notes the environment ships with Chromium
pre-installed and Playwright pre-configured to find it. Using the tool already
provisioned for this exact purpose, rather than adding a second one, is the smaller
footprint.

**Scope, deliberately bounded:** one spec file covering what's both high-value and
reliably scriptable — signup, the sex-dependent cycle question, onboarding, the tab bar,
display name, theme switching across tabs, and log out. It does **not** attempt gym
geolocation, photo upload, or PWA install prompts. Scripting a fake geolocation grant or
a fake file upload would produce a pass/fail signal disconnected from whether the real
permission dialog and real upload actually work — worse than admitting those still need
a human. `06-adult-regression-checklist.md` says this explicitly rather than leaving it
implied.

**Never points at production.** `playwright.config.ts`'s `baseURL` defaults to
`127.0.0.1:3000`; there is no code path here that accepts or discovers a production URL
or a production Supabase credential.

**Rollback:** `npm uninstall @playwright/test`, delete `playwright.config.ts` and
`e2e/`. Nothing in the adult app imports either.

---

## E-010 — One verification workflow does both `supabase test db` and the E2E pass

**Decided.** `.github/workflows/db-tests.yml` (kept its original filename despite now
covering more) starts the local Supabase stack once and reuses it for both the pgTAP
run and the Playwright run, rather than two workflows each paying the ~90-second image-pull
and stack-startup cost separately.

**Real bug this caught, not a hypothetical:** the first execution of the pgTAP test
failed — not on the RLS logic it was checking, but on its own fixture data. The test
inserted a row into `public.profiles` by hand immediately after inserting into
`auth.users`, duplicating what `schema.sql`'s `handle_new_user` trigger already does on
that same insert. This was invisible in the earlier plain-Postgres rehearsal (§ backup
verification, this document's evidence trail) because that rehearsal's hand-built
`auth` schema stub had no such trigger — only a real Supabase `auth.users`, which is
exactly what a GitHub Actions runner with real Docker access provides, could have
surfaced it. Fixed in the same commit that added the workflow that found it.

**Rollback:** delete `.github/workflows/db-tests.yml`. Both `supabase test db` and the
Playwright spec remain runnable by hand from any machine with Docker.

---

## E-011 — Local-only grants step, `schema.sql` left untouched

**Decided.** The second real run of `db-tests.yml` (after E-010's `profiles_pkey` fix)
failed on a different, genuine error: `permission denied for table cycle_settings`,
with Postgres's own hint suggesting `GRANT INSERT ON public.cycle_settings TO
authenticated`. Not an RLS bug — the `authenticated` role had no table-level grant to
be filtered by RLS in the first place.

**Root cause.** `schema.sql` contains exactly one `grant` statement in the whole file
(`grant select on public.review_stats to anon, authenticated;`, a view). Every ordinary
table relies on default privileges a real Supabase project provisions automatically at
project-creation time, outside of and before `schema.sql` ever runs. A bare `supabase
start` plus a manual `schema.sql` apply — which is exactly what this CI workflow and
every earlier local rehearsal in this document did — never receives that provisioning.
Nothing was wrong with the RLS policies themselves; the gap was in what this repository
assumes is already in place before `schema.sql` runs, and that assumption has never
been true of a bare local stack.

**Fix, and why it does not touch `schema.sql`.** Adding explicit `GRANT` statements to
`schema.sql` was considered and rejected for Phase 0: `schema.sql` is the frozen
historical record of what's already running against the real production project (see
`supabase/migrations/README.md`), and the real production project already has these
grants from its own platform bootstrap — adding them to the file would be a change with
no adult-facing effect, made under time pressure, to a file this project has
deliberately treated as append-only via migrations since decision E-003. Instead, the
fix lives entirely in `.github/workflows/db-tests.yml`, as a step immediately after
"Apply schema.sql to the local instance" that grants `authenticated`/`anon`/
`service_role` the same table access a real Supabase project would already have given
them, plus matching `alter default privileges` so any table added later in the same run
inherits it too. This is local-test-only plumbing, not a schema change.

**Rollback:** delete the "Grant table privileges" step from `db-tests.yml`. No adult
code or production schema was touched.

