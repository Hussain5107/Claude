# FORGE — Architecture Audit

**Scope:** the existing adult application, and what adding a Kids Mode would mean for it.
**Status:** analysis only. No code changed, no migrations written, no routes added.
**Audited at:** commit `2b6d587` (`Hussain5107/Claude` @ `forge-saas-app`) / `23de4d5` (`Hussain5107/forge-saas` @ `main`).

> **Caveat on independence.** This audit was produced by the same agent that wrote
> most of the code under review. It is accurate about *what exists* — every claim
> below was re-derived from the repository, not from memory — but it is not an
> independent second opinion. Findings about design quality should be weighted
> accordingly, and a genuinely adversarial review by another party is worth having
> before committing to the Kids Mode plan in §16.

---

## 1. Executive summary

FORGE is a single Next.js 16 application on Supabase, roughly **10,500 lines across 78
source files**. It is small, coherent, and has no service boundaries to speak of: one
app, one database, one auth system, one deployment. That is the right shape for its
size and it is why Kids Mode is tractable.

**The application is in better shape than its process is.** The code is consistent and
the data model is disciplined — 41 row-level-security policies, every table own-row
scoped. But there is **no test suite of any kind**, **no CI beyond a deploy hook**, and
until today the same application lived in two Git repositories with divergent history,
which caused several hours of "why isn't my change deploying". Adding a second product
surface to a codebase with zero automated tests is the single largest risk in this
project, and it is a process risk, not an architectural one.

**Three findings dominate the Kids Mode decision:**

1. **The schema assumes one human per login.** `programs` is primary-keyed on
   `user_id`. `progress`, `workout_sets`, `streaks`, `personal_records` and
   `daily_intake` are all keyed on `user_id` referencing `profiles(id)`, which is 1:1
   with `auth.users`. A parent with three children breaks that assumption everywhere.
   This is the central architectural decision and §19 addresses it directly.

2. **Children's data is a legal question before it is a technical one.** Storing
   profiles for under-13s engages COPPA in the US, GDPR Article 8 in the EU, and the
   UAE's PDPL. This is not a footnote — it determines whether children get auth
   identities at all, what may be stored, and whether YouTube can be embedded. See
   §12 and §24. It should be resolved before any schema is written.

3. **The seams needed already exist.** The generator is a pure function over a profile
   (`generateProgram(profile) → GeneratedProgram`), the exercise library is plain data
   selected by equipment, `src/lib/entitlements.ts` is a working feature-gate module,
   and every UI colour already flows from CSS variables. Kids Mode can reuse the
   engine, the auth, the design system and the deployment without touching adult code.

**Recommendation in one line:** build Kids Mode as a **sibling route group under the
same app, same auth, same database**, with child profiles as *subject rows owned by a
parent user* rather than as auth users — and write tests for the shared engine before
a second consumer depends on it.

---

## 2. Technology stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router, Turbopack | 16.2.11 |
| UI | React | 19.2.4 |
| Language | TypeScript (strict) | ^5 |
| Styling | Tailwind CSS v4, CSS custom properties | ^4 |
| Auth | Supabase Auth via `@supabase/ssr` cookies | ^0.12.3 |
| Database | Supabase Postgres, RLS-enforced | — |
| ORM | **None** — `supabase-js` query builder directly | ^2.110.8 |
| Maps | Leaflet + OpenStreetMap/Overpass, CARTO tiles | ^1.9.4 |
| Push | `web-push` (VAPID) | ^3.6.7 |
| Hosting | Vercel (Hobby), Vercel Cron | — |
| Tests | **None** | — |
| CI | **None** for the app | — |

Seven runtime dependencies total. Deliberately thin: no state library, no component
library, no ORM, no test runner, no analytics SDK.

---

## 3. Current architecture

```
Browser (PWA, installable, standalone)
   │
   ├─ Server Components ──► supabase-js (user's cookie session) ──► Postgres + RLS
   ├─ Server Actions    ──► same, all writes go through here
   ├─ /api/gyms         ──► Overpass API proxy (auth-checked)
   └─ /api/cron/reminders ─► service-role client + web-push   ◄── Vercel Cron (hourly)
                                    │
   middleware (proxy) ──────────────┘  refreshes the session cookie, gates non-public paths
```

**Data flow.** Server Components read directly from Postgres using the caller's own
session, so RLS is the authorization layer. Mutations are Server Actions — there is no
REST/GraphQL layer for app data, and no client-side data fetching except the gyms
proxy. The only code that bypasses RLS is `src/lib/supabase/service.ts`, used by the
cron route alone, with a comment forbidding client import.

**The workout engine is pure.** `generateProgram(profile)` takes a `UserProfile` value
object and returns a `GeneratedProgram` — no I/O, no database, no randomness beyond a
deterministic hash. The result is persisted once as JSONB in `programs.program`. This
is the most reusable asset in the codebase.

---

## 4. Folder structure

```
forge-saas/
├── src/
│   ├── app/                     # routes; each feature folder owns its actions.ts
│   │   ├── api/{gyms,cron/reminders}/
│   │   ├── auth/{callback,signout}/
│   │   ├── dashboard/           # the signed-in shell (layout.tsx = tab bar + theme)
│   │   │   ├── cycle/actions.ts # actions only, no page
│   │   │   ├── gyms|progress|settings|workouts/
│   │   ├── login|signup|onboarding|pricing/
│   │   ├── layout.tsx  globals.css  manifest.ts
│   ├── components/              # 24 components, flat + landing/ subfolder
│   ├── hooks/useSpeech.ts
│   ├── lib/
│   │   ├── exercises/           # the engine + 3 data libraries (~2,000 LOC)
│   │   ├── supabase/            # client | server | middleware | service
│   │   └── *.ts                 # 13 pure domain modules
│   └── middleware.ts
├── supabase/schema.sql          # single idempotent script, 18 numbered sections
├── public/images/               # 99 exercise photos, slug-named
├── docs/
└── vercel.json                  # 24 hourly cron entries
```

**Convention worth preserving:** a route folder owns its `actions.ts`. Domain logic
lives in `src/lib` as pure functions; anything needing a Supabase client but not being
an action goes in a `*Server.ts` module (see `cycleServer.ts`) because a `"use server"`
file may only export async actions.

---

## 5. Authentication review

**Model.** Supabase Auth, email + password, cookie sessions via `@supabase/ssr`. Four
client factories, correctly separated: browser, server (RSC/actions), middleware, and
service-role.

**Session handling.** `src/middleware.ts` runs `updateSession` on page navigations
only. The matcher deliberately excludes `api/`, static assets, `sw.js` and
`manifest.webmanifest` — **this exclusion is load-bearing.** Supabase refresh tokens
are single-use; when a PWA cold start fetched the page, the manifest and the service
worker simultaneously, all three raced to redeem the same token, one won and the others
destroyed the session. Do not widen this matcher without understanding that.

**Authorization.** There are no roles. Authorization is entirely "is this row yours",
enforced by 41 RLS policies of the form `auth.uid() = user_id`. Route protection is
belt-and-braces: middleware redirects unauthenticated users, and every page re-checks
`getUser()` and redirects itself.

**Public paths.** `/`, `/login`, `/signup`, `/pricing`, `/auth/*`.

**Secrets.** Seven environment variables. Three are `NEXT_PUBLIC_` and correctly
public (Supabase URL, anon key, VAPID public key). `SUPABASE_SERVICE_ROLE_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET` are server-only. No secrets in
the repo; `.env.local` is gitignored and untracked (verified).

**Findings:**

- ✅ Service-role key is confined to one file used by one route.
- ✅ The cron route checks `CRON_SECRET` itself and is excluded from middleware, so an
  unauthenticated caller is rejected rather than redirected.
- ⚠️ **No rate limiting anywhere.** `/api/gyms` proxies an external API on behalf of any
  signed-in user. Low impact today, worth noting before opening a second surface.
- ⚠️ **No email verification enforced.** It was disabled during development because the
  Resend sandbox sender only delivers to the account owner. Anyone can register with an
  address they don't control. **This matters much more for Kids Mode** — a parent
  account is a guardianship claim, and it should be a verified one.
- ⚠️ No password reset flow exists.

---

## 6. Database review

**13 tables, 1 view, 1 storage bucket, 41 RLS policies.** All in `public`, all RLS-on,
all own-row.

| Table | Key | Purpose | Kids Mode verdict |
|---|---|---|---|
| `profiles` | `id` → `auth.users` | 1:1 with login; 17 added columns | **Extend, never restructure** |
| `programs` | `user_id` **PK** | one JSONB program per user | ⚠️ **PK blocks multi-subject** |
| `progress` | `(user_id, log_date, exercise_slug)` | done/notes per exercise per day | Needs a subject dimension |
| `workout_sets` | `user_id` | one row per logged set | Needs a subject dimension |
| `personal_records` | `user_id` | best e1RM per exercise | Adult-only; do not reuse for kids |
| `streaks` | `user_id` | current/longest/total | Reusable shape |
| `daily_intake` | `(user_id, log_date)` | water + protein | Adult-only |
| `health_metrics` | `user_id` | BP/pulse | Adult-only |
| `progress_photos` | `user_id` | storage URLs | ❌ **Never extend to children** |
| `reviews` | `user_id` | app rating | Shared |
| `push_subscriptions` | `endpoint` unique | web push | Shared (parent device) |
| `cycle_settings` / `cycle_checkins` | `user_id` | opt-in, female, private | Adult-only |
| `review_stats` (view) | — | public aggregate only | Shared |

**The blocking issue, stated precisely.** `programs.user_id` is a **primary key**, so
one login can hold exactly one program. `progress` is unique on
`(user_id, log_date, exercise_slug)`, so two children training the same movement on the
same day under one parent account would collide. Both are correct for the adult product
and both must change shape — *additively* — for children. §19 gives two options.

**Strengths.** Idempotent schema (`if not exists` / `or replace` / `drop policy if
exists`) so re-running is safe. Delete policies exist where the user has a right to
erasure (`cycle_settings`, `cycle_checkins`, `progress_photos`). The `review_stats`
view exposes only an aggregate, letting the landing page show a rating without
loosening row policies — a good pattern to copy.

**Weaknesses.**

- **No migration tool.** `schema.sql` is one growing file run by hand in the Supabase
  SQL editor. There is no ordering guarantee, no down-migrations, no record of what
  has been applied to production. It has worked so far because every statement is
  idempotent. It will not scale to a second team member.
- **No backups.** Supabase free tier has none. The database is the only copy.
- Some check constraints live inline in `create table` and cannot be altered later
  without a table rewrite; newer ones are named constraints added separately, which is
  the better pattern.
- No indexes on `workout_sets(user_id, log_date)` despite the progress page reading the
  full history. Fine at current volume.

---

## 7. Routing review

18 routes. Static (`○`) vs dynamic (`ƒ`) matters for cost and cache behaviour:

| Route | Type | Notes |
|---|---|---|
| `/` | ○ 1h ISR | landing; must stay static |
| `/login` `/signup` `/onboarding` `/pricing` | ○ | |
| `/dashboard` | ƒ | Home tab |
| `/dashboard/workouts` | ƒ | session + logging |
| `/dashboard/progress` `/dashboard/gyms` `/dashboard/settings` | ƒ | |
| `/api/gyms` `/api/cron/reminders` | ƒ | |
| `/auth/callback` `/auth/signout` | ƒ | |
| `/manifest.webmanifest` | ƒ | forced dynamic to defeat stale PWA caches |
| `/icon.png` `/apple-icon.png` | ○ | |

`/dashboard/layout.tsx` is the app shell: it resolves the theme server-side, sets
`data-theme`, and renders the bottom tab bar. **Any Kids route placed under
`/dashboard` inherits the adult tab bar and adult theme** — which is why §16
recommends a sibling group, not a nested one.

The tab bar in `BottomTabBar.tsx` has a hardcoded five-item `TABS` array. Kids Mode
needs its own navigation; do not parameterise this one.

---

## 8. API review

There is **no application API**. All app data flows through Server Components (reads)
and Server Actions (writes). Two HTTP routes exist for reasons that don't apply to app
data:

- **`/api/gyms`** — proxies Overpass because the browser shouldn't call it directly
  (CORS, mirror failover, and it needs an auth check). Returns haversine-sorted results.
- **`/api/cron/reminders`** — invoked by Vercel Cron hourly (24 entries in
  `vercel.json`, because Hobby cron cannot express `0 * * * *`). Checks `CRON_SECRET`,
  uses the service-role client, sends web push, and prunes dead subscriptions on
  404/410.

**23 Server Actions** across five `actions.ts` files. All follow the same shape:
`requireUser()` → validate → write with the user's own client → `revalidatePath` →
return `{ error: string | null }`. Errors are returned, not thrown.

**Implication for Kids Mode:** there is no API surface to extend and no versioning to
worry about. Kids actions are new files in new route folders. Nothing existing needs to
change.

---

## 9. Component review

24 components. No component library — everything is bespoke on Tailwind + CSS
variables.

**Primitives** (`src/components/ui.tsx`): `Card`, `Button`, `Label`, `Input`, `Select`,
`Checkbox`, `ErrorText`. Fully theme-driven; **reusable by Kids Mode as-is.**

**Shell:** `AppHeader` (sticky, safe-area aware), `BottomTabBar` (fixed, hardcoded
tabs), `Avatar`, `Logo`, `ThemeProvider`, `ThemePicker`, `Ring`.

**Adult-specific, do not reuse:** `DashboardClient` (396 lines), `HomeClient` (429),
`ExerciseCard` (547), `SettingsClient` (602), `ProgressClient`, `CycleCard`,
`CycleBanner`, `CycleSettingsCard`, `AiCoachPanel`, `NutritionToast`, `SessionExtras`.

**Reusable with care:** `Avatar`, `Ring`, `AppHeader`, `ui.tsx`, `InstallAppPrompt`.

**Finding.** The four `*Client.tsx` components are large and mix layout, state and
server-action calls. They are not a problem today — each is one screen with one owner —
but they are not a base to build on. Kids screens should be new components that reuse
the *primitives*, not variants of these.

---

## 10. State management review

There is no state management library, and none is needed.

- **Server state** is fetched per-request in Server Components. No client cache.
- **Local UI state** is `useState` inside client components, with optimistic updates
  followed by a Server Action and `router.refresh()` on anything the server owns.
- **Cross-cutting state** is one React context (`ThemeProvider`), which holds a value
  resolved on the server and never changes on the client — deliberately, so there is
  no theme flash.
- **Device preferences** are `localStorage` (`forge:voiceCoach`, `forge:nutritionTip:*`,
  `forge:levelUpDismissed`).

**Consequence for Kids Mode:** the "which child is active" selection is a new kind of
state this app has never had — it must survive navigation and reload, and it must be
authoritative on the server (a client-only choice could be forged). Recommend a signed
cookie or a URL segment, not context. See §16.

---

## 11. Existing workout architecture

This is the asset most worth reusing, so it is worth stating precisely how it works.

**Three data libraries**, same shape, selected by equipment:

| Library | File | Exercises | Selected when |
|---|---|---|---|
| Gym | `data.ts` | 43 | `trainingLocation = 'gym'` |
| Home dumbbell | `homeDumbbellData.ts` | 41 | `home` + `hasDumbbells` |
| Bodyweight / park | `bodyweightData.ts` | 36 | `home` + no dumbbells |

99 unique exercises. Each carries: slug, name, equipment, primary/secondary muscles,
base sets/reps/rest/RPE, tempo, difficulty, breathing, cues, common mistakes,
alternatives, a tip, a slug-derived image path, and an optional curated `videoUrl`.

**Pipeline:**

```
UserProfile
  → libraryFor()        picks one of the three libraries by equipment
  → buildSplit()        rearranges 6 PPL days into 3/4/5/6-day splits
  → prescribeExercise() sets/reps/rest/RPE from goal + experience
  → nutrition targets   Mifflin-St Jeor BMR → TDEE → calories/protein/water
  → GeneratedProgram    persisted as JSONB
```

**Supporting pure modules:** `dayRotation.ts` (per-user weekday offset so colleagues
don't all get leg day on Tuesday), `splits.ts`, `alternatives.ts` (tiered exercise
swapping), `progression.ts`, `cardio.ts`, `nutritionTips.ts`, `tracking.ts` (Epley
e1RM), `cycle.ts` / `cycleAdaptation.ts`, `voiceCoach.ts`.

**Why this matters for Kids Mode.** `generateProgram` is a pure function over a value
object. A kids generator can be a *sibling* — same signature discipline, its own data
library, its own prescription rules — reusing `types.ts`, `splits.ts` and the
`ExerciseTemplate` shape without touching the adult path. **Do not** add an `isKid`
branch inside `prescribeExercise`; children are not scaled-down adults and the
prescription rules genuinely differ (no 1RM work, no failure training, play-based
volume).

---

## 12. Risks

| # | Risk | Severity | Notes |
|---|---|---|---|
| R1 | **Zero automated tests** | **High** | 10.5k LOC, no unit/integration/E2E. Every regression is caught by a human clicking. A second product surface doubles the surface with no safety net. |
| R2 | **Children's data compliance** | **High** | COPPA / GDPR Art.8 / UAE PDPL. Determines schema, auth, and whether YouTube can be embedded. Legal question, not technical. §24. |
| R3 | **Two repositories, divergent history** | **High** | `Claude` and `forge-saas` hold the same app with different SHAs. Caused a multi-hour "why won't it deploy" today. Must be resolved to one. |
| R4 | **No database backups** | **High** | Supabase free tier. The production database is the only copy of every user's history. |
| R5 | **No email verification** | Medium | A parent account is a guardianship claim; it should be verified. |
| R6 | **Single JSONB program per user** | Medium | `programs.user_id` PK blocks multi-child directly. Solvable, but it is the schema's load-bearing assumption. |
| R7 | **Hand-run schema.sql** | Medium | No record of what production has applied. Already caused "I ran the SQL but nothing changed" confusion. |
| R8 | **No rate limiting** | Low | `/api/gyms` proxies a public API per signed-in user. |
| R9 | **Vercel Hobby is non-commercial** | Low | Monetising requires Pro. |
| R10 | **Middleware matcher is fragile** | Low | Widening it re-breaks PWA sessions. Documented in-file; keep it that way. |

---

## 13. Technical debt

**Testing — the honest picture.** There is no test framework installed, no test file,
no coverage measurement, and no CI running anything. `npm run lint` and `npx tsc
--noEmit` are the entire automated safety net. Two pure modules (`dayRotation`,
`cycle`/`cycleAdaptation`) were verified with throwaway scripts that were not kept.

This is the most consequential debt in the repository, and Kids Mode is the reason to
pay some of it down: the moment two products share the exercise engine, a change made
for one can silently break the other.

**Other debt, roughly by cost:**

- Four `*Client.tsx` components exceed 390 lines and mix concerns.
- ~10 pre-existing `react-hooks/set-state-in-effect` lint errors, consistent across the
  codebase (the "read localStorage after mount" pattern). Suppressed by not running
  lint in CI.
- `AGENTS.md` warns that this Next.js version differs from training data — a real
  constraint, and evidence that framework upgrades will need care.
- `src/lib/exercises/_data.json` appears unused.
- 56 of the 99 exercise photos are 208×208 crops from contact sheets, against 480×320
  for the rest. Functional, visibly softer.
- The middleware deprecation warning (`middleware` → `proxy`) is unaddressed.

---

## 14. Opportunities

- **The engine is already a library.** Pure functions over value objects, no I/O. A
  kids generator slots in beside it.
- **`src/lib/entitlements.ts` is a working feature-gate.** `hasFeature(plan, feature)`
  with a single `AVAILABLE_ON` map. Kids Mode is one entry away from being gateable,
  and later monetisable, without touching call sites.
- **Theming is fully tokenised.** Everything paints with `var(--primary)` /
  `var(--secondary)` under `[data-theme]`, applied server-side. A bright kids palette
  is a CSS block, not a component fork.
- **`profiles` is already an extension point.** 17 columns have been added additively
  without a single migration breaking anything.
- **The `review_stats` view pattern** — owner-privileged view exposing only aggregates —
  is exactly what a parent dashboard needs for "show me my child's summary without
  handing over raw rows".
- **99 slug-named images and curated `videoUrl`s** — the media pipeline for a kids
  library is already designed.

---

## 15. What should never change

Treat as read-only unless a change is unavoidable and deliberate:

1. **`src/middleware.ts` matcher.** Load-bearing for PWA session survival and for the
   cron route's own auth.
2. **`src/lib/supabase/service.ts` import boundary.** Server-only, one consumer.
3. **Existing `profiles` columns.** Add; never rename, retype, or repurpose.
4. **The adult generator path** — `generator.ts`, `splits.ts`, `data.ts`,
   `homeDumbbellData.ts`, `bodyweightData.ts`, `dayRotation.ts`. Extend by adding
   siblings, not branches.
5. **Existing RLS policies.** New tables get new policies; existing ones stay.
6. **`/dashboard/*` routes and `BottomTabBar` contents.** Adult navigation is finished.
7. **`programs.program` JSONB shape.** Live user data is stored in this shape and read
   defensively (`program.daysPerWeek ?? 6`). Only additive fields.
8. **`/` static rendering.** Anything that makes the landing page dynamic costs money
   and speed.
9. **The `revalidatePath("/dashboard", "layout")` convention** for anything the shell
   renders.

---

## 16. Kids Mode integration strategy

### Recommendation

| Question | Recommendation | Why |
|---|---|---|
| Separate application? | **No** — same Next.js app | Shared auth, shared engine, one deploy, one domain. A second app means a second session and a second deployment for no benefit at this size. |
| Separate module? | **Yes** — `src/lib/kids/*` and `src/app/kids/*` | Clear boundary, independently deletable, no adult imports. |
| Separate routes? | **Yes** — `/kids/*` and `/parent/*`, siblings of `/dashboard` | `/dashboard/layout.tsx` injects the adult tab bar and adult theme. Nesting under it would force conditionals into the adult shell — the one thing to avoid. |
| Shared auth? | **Yes** — one parent login, no child logins | See below. This is the key decision. |
| Shared database? | **Yes** — same Postgres, new tables | Parent-child queries stay in one place; RLS extends naturally. |
| Shared components? | **Primitives only** | `ui.tsx`, `Avatar`, `Ring`, `AppHeader`. Not the `*Client` screens. |
| Shared API? | **N/A** | No API layer to share; new Server Actions in new folders. |

### Why children should not be auth users

The parent holds the account; children are **subjects owned by that account**, not
identities. This is both the compliance-safe and the simpler design:

- A child under 13 cannot meaningfully consent to an account, and creating auth
  identities for them makes COPPA/GDPR-K far harder to satisfy.
- No child email, no child password, no child session to secure or reset.
- RLS stays trivially simple: every kids row carries `parent_user_id`, and every policy
  is still `auth.uid() = parent_user_id`. The existing 41-policy pattern extends
  unchanged.
- The parent can delete a child profile and all its data in one cascade.

**Consequence:** "which child is active" is server-side state. Recommend the child id
as a **URL segment** (`/kids/[childId]/...`) validated on every request against the
caller's ownership — not a cookie, not context, because those are easier to get wrong
and a mis-scoped read means one child seeing another's data.

### Route shape

```
/dashboard/*   ← adult, unchanged
/parent        ← child list, add/edit child, per-child summary  (auth required)
/kids/[childId]/*  ← the child-facing experience               (auth required, ownership checked)
```

`/kids` sits behind the parent's session. A "kid mode lock" (PIN to leave) is a UX
feature, never a security boundary — say so plainly in any spec.

---

## 17. Recommended folder structure

```
src/
├── app/
│   ├── dashboard/        # UNCHANGED
│   ├── parent/
│   │   ├── layout.tsx    # parent shell — its own nav, adult theme
│   │   ├── page.tsx
│   │   └── actions.ts    # child CRUD
│   └── kids/
│       └── [childId]/
│           ├── layout.tsx  # kids shell — kids theme, kids nav, ownership check
│           ├── page.tsx
│           └── actions.ts
├── components/
│   ├── kids/             # all kid-facing components live here
│   └── parent/
└── lib/
    ├── exercises/        # UNCHANGED
    └── kids/
        ├── types.ts       # ChildProfile, KidsProgram, AgeBand
        ├── data.ts        # kids exercise library
        ├── generator.ts   # sibling of exercises/generator.ts
        ├── xp.ts          # pure: XP curve, level thresholds
        ├── missions.ts    # pure: mission definitions + completion rules
        ├── badges.ts      # pure: badge criteria
        ├── videos.ts      # curated allow-list, id + title only
        └── kidsServer.ts  # child ownership resolution (needs a Supabase client)
```

**Rule:** `src/lib/kids/*` must not import from `src/app/*`, and adult code must not
import from `src/lib/kids/*`. Sharing goes one way only — kids may import
`exercises/types.ts` and `exercises/splits.ts`.

---

## 18. Recommended module structure

Follow the existing discipline exactly, because it is why the codebase is easy to
extend:

- **Pure domain logic in `src/lib`.** XP curves, mission rules and badge criteria
  should be functions with no I/O, so they can be unit tested and reasoned about.
- **Server-only helpers in `*Server.ts`.** Ownership resolution needs a Supabase client
  and is not an action — `cycleServer.ts` is the template.
- **Actions in the route folder that uses them**, all returning `{ error }`.
- **One entitlement key** — add `kids_mode` to `AVAILABLE_ON` in `entitlements.ts`.

---

## 19. Recommended database changes

**Additive only. No existing table is altered.**

### New tables (shapes, not migrations)

- **`child_profiles`** — `id` (uuid PK), `parent_user_id` → `profiles(id)` on delete
  cascade, display name, birth year *or* age band, avatar, activity preferences,
  created/updated. RLS: all four verbs, `auth.uid() = parent_user_id`.
  - **Store an age band, or a birth year — not a full date of birth.** Precise DOB for
    a minor is more personal data than the feature needs, and data you don't hold is
    data you can't leak.
- **`child_programs`** — `child_id` PK, JSONB program. Mirrors `programs`, keyed on the
  child instead of the user. Deliberately a separate table, not a widened `programs`.
- **`child_activity`** — one row per completed session or mission, `child_id` +
  `log_date`. Replaces the adult `progress`/`workout_sets` pair with something simpler:
  **children should not be logging weights.**
- **`child_rewards`** — XP ledger and badges earned, `child_id`.

### Why new tables rather than extending existing ones

Adding a nullable `child_id` to `progress`, `workout_sets` and `streaks` would work, but
it would:

- weaken every existing RLS policy into a two-branch condition,
- put child rows into tables read by adult screens, risking leakage through a missed
  filter,
- break the `programs.user_id` primary key regardless.

Separate tables keep adult queries provably unchanged, which is the stated requirement.

### Never extend to children

`progress_photos` (body photos of minors — do not build this), `health_metrics`,
`cycle_settings` / `cycle_checkins`, `personal_records`, `daily_intake`.

### Parent dashboard reads

Use the `review_stats` pattern: an owner-privileged **view** exposing per-child
aggregates, rather than granting the parent screen raw row access.

---

## 20. Recommended API changes

**None to the existing surface.** No existing action, route or signature changes.

New Server Actions, all following the established shape:

- `app/parent/actions.ts` — `createChild`, `updateChild`, `deleteChild` (cascade),
  `regenerateChildProgram`.
- `app/kids/[childId]/actions.ts` — `completeMission`, `logKidsSession`, `awardXp`.
  **XP and badge awards must be computed server-side from what actually happened** — a
  client-supplied XP amount is a cheat code.

The cron reminder route may later gain a parent-facing nudge; it needs no structural
change to do so.

---

## 21. Migration strategy

The project has no migration tooling, and Kids Mode is the right moment to fix that —
but not by rewriting history.

**Recommended, in order:**

1. **Keep `schema.sql` as the source of truth** for what production should look like.
   Continue the numbered-section, idempotent convention (Kids Mode = §19+).
2. **Add a `supabase/migrations/` folder** for new work, one timestamped file per
   change, and record which have been applied. Do not retro-fit the existing 18
   sections — that risks breaking a working database for no user benefit.
3. **Take a manual database dump before the first kids migration.** There are no
   backups; this is the one irreversible risk in the whole plan.
4. **Ship the schema before the code.** Every additive statement is a no-op for the
   adult app, so it can be applied days ahead with zero user impact.

---

## 22. Feature flag strategy

The mechanism already exists — `src/lib/entitlements.ts`:

```ts
const AVAILABLE_ON: Record<Feature, Plan[]> = {
  cycle_adaptive: ["free", "pro"],
  ai_export:      ["free", "pro"],
};
```

**Recommendation:**

1. Add `kids_mode` to `Feature` and to `AVAILABLE_ON`, initially `[]` — available to
   nobody. Ship schema and code dark.
2. For a controlled rollout, gate on a per-profile opt-in column
   (`kids_mode_enabled boolean not null default false`) rather than the plan, so it can
   be turned on per account.
3. Gate in three places, all cheap: the `/parent` and `/kids` layouts (redirect if
   off), the entry point on the adult Home screen (hide the link), and every kids
   Server Action (a hidden UI is not a permission).
4. When it graduates, move it to `["free", "pro"]` and drop the column. One file.

---

## 23. Rollback strategy

Kids Mode is designed to be **deletable**, which is the strongest rollback available.

| Layer | Rollback |
|---|---|
| Feature flag | Set `kids_mode: []`. Instant, no deploy, adult app untouched. |
| Code | Revert the deploy in Vercel, or delete `src/app/kids`, `src/app/parent`, `src/lib/kids`, `src/components/kids`. No adult file imports them, so nothing else breaks. |
| Database | New tables only. Dropping them cannot affect adult data — no existing table is altered, no existing column changes type. |
| Data | Children's rows cascade from `child_profiles`; one delete removes everything. |

**The rollback only stays this clean if the constraint in §17 holds:** no adult file
may import from `src/lib/kids` or `src/components/kids`. Worth enforcing with a lint
rule rather than discipline.

---

## 24. Questions that require human decisions

Ordered by how much they change the architecture. **The first four should be answered
before any schema is written.**

**1. Which jurisdictions, and what is the minimum age?**
COPPA (US, under 13) requires verifiable parental consent and restricts data collection
and behavioural advertising. GDPR Article 8 (EU) sets 13–16 depending on member state.
The UAE PDPL applies if users are there. This determines whether verified parental
consent is needed, what may be stored, and how long. *This is a legal question — get an
actual answer, not an engineering guess.*

**2. Can YouTube be embedded on a child-facing screen?**
A standard embed loads Google's player with recommendations and possibly ads. Options:
`youtube-nocookie.com` with `rel=0`; link out to the YouTube app; or host short clips
yourself. Each has a different compliance and cost profile. **Also:** who reviews each
video, and what happens when a curated video is deleted or its channel changes hands?
A curated allow-list needs an owner, not just a schema.

**3. Are children auth users, or subjects of a parent account?**
§16 recommends subjects. Confirm explicitly — everything in §19 follows from it.

**4. Is email verification going to be required for parent accounts?**
It is currently off. A guardianship claim from an unverified address is weak.

**5. What is the age range, and how many bands?**
"Kids" spans 5 to 15, which is not one program. Age bands drive the data library, the
prescription rules, and the tone of every screen.

**6. Who signs off on child exercise safety?**
The adult program was built from established training principles. Youth resistance
training has its own guidance (NSCA, AAP) around loading, technique-first progression
and growth-plate considerations. Someone qualified should review the kids library
before it ships.

**7. How motivating should XP and rewards be?**
Streaks and badges drive engagement — that is the point, and it is also the risk with
children. Decide deliberately: is a child ever told they *lost* a streak? Is there a
daily cap? Does the parent see pressure the child feels?

**8. What does the parent see?**
"All activity" and "a weekly summary" are very different products, and the second is
usually the better one. It also determines whether the aggregate view in §19 is enough.

**9. One repository or two?**
`Claude` and `forge-saas` currently both hold this app. Pick one before adding a second
product to it.

**10. Testing — will this be funded?**
Adding a second consumer to an untested engine without tests is a choice. It is
defensible for a free side project; it should be a decision, not an accident.

---

## Implementation roadmap

No code until the audit is accepted and §24 items 1–4 are answered.

### Phase 0 — Decisions and safety net *(blocking)*
Answer §24 Q1–Q4. Consolidate to one repository. Take a manual database backup.
Establish `supabase/migrations/`. **Add a test runner and cover the pure engine
modules** (`generator`, `splits`, `dayRotation`, `progression`) — these are about to
gain a second consumer.

### Phase 1 — Foundations *(no user-visible change)*
`kids_mode` entitlement, defaulting to nobody. `child_profiles` table + RLS.
`src/lib/kids/types.ts`. Ownership resolution helper. Ships dark.

### Phase 2 — Parent surface
`/parent` route group. Create, edit and delete child profiles. Deletion cascade proven
before anything else is built on top.

### Phase 3 — Kids workout engine
Kids exercise library with age bands. `src/lib/kids/generator.ts` as a sibling of the
adult generator. Unit tested. **Reviewed against youth training guidance (§24 Q6).**
No UI yet.

### Phase 4 — Kids experience
`/kids/[childId]` shell, kids theme, kids navigation. Session screen. `child_activity`
logging. Server-computed completion.

### Phase 5 — Motivation layer
XP, levels, missions, badges — all server-computed. `child_rewards`. Honest streak
behaviour per §24 Q7.

### Phase 6 — Media
Curated video allow-list, with a named owner for review. Player choice per §24 Q2.

### Phase 7 — Parent dashboard
Aggregate view (the `review_stats` pattern). Weekly summary.

### Phase 8 — Rollout
Enable per account via the opt-in column. Watch. Then flip the entitlement to `free`.

---

*End of audit. No production code was written, no files outside `docs/` were modified,
and no migrations were generated.*
