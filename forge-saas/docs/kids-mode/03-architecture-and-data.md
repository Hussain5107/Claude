# 03 — Architecture and data

Shapes and boundaries. **No migrations, no schema statements, no code.** Column lists
are intent, to be reviewed before anything is written.

---

## 1. Where Kids Mode attaches

```
src/app/
├── dashboard/          UNCHANGED — adult shell (layout.tsx:34,39 injects theme + tab bar)
├── parent/             NEW — parent surface, own layout, own nav
│   ├── layout.tsx        flag check + auth
│   ├── page.tsx
│   └── actions.ts        child CRUD
└── kids/               NEW — child surface, own layout, own nav, kids theme
    └── [child]/
        ├── layout.tsx    flag check + auth + ownership resolution
        ├── page.tsx
        └── actions.ts

src/lib/
├── exercises/          UNCHANGED
└── kids/               NEW — pure domain logic
    ├── types.ts
    ├── content.ts        age-banded sessions (see P-003)
    ├── rewards.ts        pure: XP / level / badge rules
    ├── videos.ts         curated allow-list
    └── kidsServer.ts     ownership resolution — needs a Supabase client

src/components/
├── kids/               NEW
└── parent/             NEW
```

**Verified.** Sibling placement is forced by `src/app/dashboard/layout.tsx:34,39`, which
renders `data-theme` and `<BottomTabBar />` for every nested route, and by
`src/components/BottomTabBar.tsx:22`, which hardcodes the five adult tabs (D-003).

**Verified.** `kidsServer.ts` exists as a separate module because a `"use server"` file
may only export async server actions — the same reason `src/lib/cycleServer.ts` exists.
That is an established pattern in this repository, not an invention.

### Import rules (P5)

| From | May import | Must not import |
|---|---|---|
| `src/lib/kids/*` | `src/lib/exercises/types.ts`, `splits.ts` | anything in `src/app/*` |
| `src/components/kids/*` | `src/components/ui.tsx`, `Avatar`, `Ring` | adult `*Client.tsx`, `BottomTabBar` |
| **any adult file** | — | **`src/lib/kids/*`, `src/components/kids/*`** |

The last row is what makes Audit §23's rollback true. **Recommend enforcing with an
ESLint `no-restricted-imports` rule rather than discipline** — the repo already has a
flat ESLint config (`eslint.config.mjs`). *Inferred; low cost, high value.*

---

## 2. Request path

```
Request /kids/2/...
  │
  ├─ middleware       session refresh; /kids is not in PUBLIC_PATHS
  │                   (src/lib/supabase/middleware.ts:8) so unauthenticated → /login
  │
  ├─ kids layout      1. getUser()          → no user? redirect
  │                   2. hasFeature(...)    → flag closed? 404 or redirect
  │                   3. resolveChild()     → not owned by caller? 404
  │
  ├─ page (RSC)       reads kids tables with the CALLER'S client → RLS applies
  │
  └─ Server Action    re-runs all three checks. Never trusts the layout.
```

**Verified.** Audit §5 records this doubled pattern already: middleware redirects, and
every page re-checks `getUser()`. Kids Mode follows it and adds the ownership check.

**Not owned → 404, not 403.** A 403 confirms the child exists. *Inferred.*

---

## 3. Child identity

**Verified constraint:** `supabase/schema.sql:54` — `programs.user_id` is a primary key.
`:85` — `progress` is unique on `(user_id, log_date, exercise_slug)`. One login, one
program, one row per exercise per day. Children need their own subject key (D-004).

**URL identifier — Open Decision (OD-5).**

| Option | |
|---|---|
| Audit: `/kids/[uuid]/...` | Ownership checked per request |
| P-001: `/kids/[index]/...` | Same check, parent-scoped; no stable child id in history or screenshots |

Both are safe. P-001 is better for a product used on shared phones. See `01` P-001.

---

## 4. Data model — intent, not schema

Four new tables. **All additive. No existing table altered** (D-004, P4).

### `child_profiles`

| Field | Notes |
|---|---|
| `id` | uuid PK |
| `parent_user_id` | → `profiles(id)` on delete cascade |
| `child_index` | small int, unique per parent, never reused — **only if P-001 approved** |
| display name | |
| age band | **not** date of birth — see `04` §3 |
| avatar | optional |
| created / updated | |

RLS: all four verbs, `auth.uid() = parent_user_id`. Delete included — the parent must be
able to erase. **Verified pattern:** `cycle_settings` already has a delete policy for
exactly this reason (`supabase/schema.sql:424`+, Audit §6).

### `child_activity`

One row per completed session. `child_id` + date + what was done + completed-at.

**This replaces the adult `progress` / `workout_sets` pair with something simpler,
deliberately: children do not log weights** (see `02` §4).

Uniqueness: a child may reasonably do two sessions in a day, so **do not** copy the
adult `unique (user_id, log_date, exercise_slug)` shape. *Inferred.*

### `child_rewards` — **only if P-002 is rejected**

If XP is derived (P-002), this table does not exist in v1.

### `child_content_progress` — deferred

Only if a child's position within a multi-part session must survive a reload. Not
needed if sessions are short. *Inferred — defer until proven.*

### Parent dashboard reads

**Verified pattern worth copying:** `review_stats` (`supabase/schema.sql:393`) is an
owner-privileged view exposing only an aggregate, which lets the landing page show a
rating without loosening row policies (Audit §6, §14).

The parent summary should use the same approach — a view returning per-child
aggregates — rather than granting the parent screen raw row access. Which shape depends
on OD-14.

### Never extended to children

`progress_photos`, `health_metrics`, `cycle_settings`, `cycle_checkins`,
`personal_records`, `daily_intake` (D-010). Audit §19.

---

## 5. Why not a REST API

Required demonstration, worked through rather than asserted.

**Verified starting point.** Audit §8: there is no application API. 23 Server Actions
across five `actions.ts` files. Two HTTP routes exist, and both exist for reasons that
do not apply to app data:

| Route | Why it is HTTP |
|---|---|
| `/api/gyms` | Proxies the external Overpass API — CORS, mirror failover, needs an auth check the browser cannot do |
| `/api/cron/reminders` | Invoked by Vercel Cron, an external caller with no session; authenticates itself with `CRON_SECRET` |

That is the principled boundary: **HTTP for external callers, Server Actions for app
data.** Kids Mode is entirely app data.

### What would force REST, and whether it applies

| Driver | Applies to Kids Mode v1? |
|---|---|
| A non-Next.js client (native app, third party) | **No.** One Next.js app (Audit §2, §3). |
| Cross-origin access | **No.** Same origin. |
| Inbound webhooks | **No.** No integrations planned. |
| Public/documented contract | **No.** No external consumers. |
| Streaming or long-lived connections | **No.** Request/response only. |
| File upload needing a signed URL | **No.** Kids upload nothing (`02` §4). |
| Caching at the CDN edge | **No.** All kids data is per-user and private. |

**None apply.** Adding REST would mean writing route handlers, hand-rolling auth per
route, hand-rolling revalidation, and maintaining a second mutation convention in a
codebase where 23 actions already follow one shape. It would add work and inconsistency
for no capability.

**Conclusion — Verified:** Server Actions satisfy every v1 requirement (D-007, P8).

**When to revisit:** a native mobile client, or a third party needing programmatic
access. Neither is in scope. If either arrives, an API can be added *alongside* the
actions rather than replacing them.

---

## 6. Feature flag

**Verified mechanism.** `src/lib/entitlements.ts:13,23,28` provides
`hasFeature(plan, feature)` over an `AVAILABLE_ON: Record<Feature, Plan[]>` map.

Two layers, both required:

1. **Kill switch** — a `kids_mode` entry in `AVAILABLE_ON`, initially `[]`. Nobody, no
   deploy needed to close it.
2. **Allow-list** — a per-profile opt-in column, so rollout is per account.

Checked server-side in three places (P9):

| Where | Why |
|---|---|
| `/parent` and `/kids` layouts | Direct URL access |
| The adult entry point revealing the link | Discoverability |
| **Every kids Server Action** | A hidden UI is not a permission (P2) |

**The adult entry point is the one adult-side change Kids Mode requires.** It should be
the smallest possible edit — a conditional link — and nothing else in adult code moves.
*Inferred; unavoidable if Kids Mode is to be discoverable at all.*

---

## 7. Testing

**Verified.** Audit §12 R1 and §13: no test framework, no test file, no coverage, no CI
running anything. `tsc --noEmit` and `eslint` are the entire safety net for ~10,500 LOC.

Minimum for Kids Mode:

| Priority | Test | Rationale |
|---|---|---|
| 1 | **A parent cannot read or write another parent's child** | P-005. RLS is the whole authorization model and none of the 41 policies is verified today (Audit §5). |
| 2 | Deleting a child removes every row for that child | `00` "done" criterion 2 |
| 3 | Flag closed → kids routes unreachable by direct URL | P9 |
| 4 | Every kids action rejects a non-owner | P2 |
| 5 | Reward rules (pure function) | Cheap, and P-002 makes them the only reward logic |

**Note on the audit's Phase 0.** Audit's roadmap puts engine unit tests first because the
generator gains a second consumer. **If P-003 is approved there is no kids generator**,
which weakens that rationale — but the adult engine still deserves tests, and P-005's
ownership test becomes clearly the first thing to write.

---

## 8. Performance

**Verified.** Audit §7: `/` is static with 1h ISR; `/dashboard/*` are all dynamic.

- Kids routes are per-user and private → dynamic, like the dashboard. Expected.
- **Route-group separation means adult bundles do not grow** while the flag is off. This
  is by construction, not by configuration.
- Kids imagery will need the same slug-named `public/images` treatment as the adult
  library (99 images, 1.3 MB total). Budget for it; keep files small.
- No new runtime dependency is anticipated (`02` N5).

---

## 9. Rollback

**Verified.** Audit §23.

| Layer | Action | Adult impact |
|---|---|---|
| Flag | `kids_mode: []` | None. Instant, no deploy. |
| Code | Delete `src/app/kids`, `src/app/parent`, `src/lib/kids`, `src/components/kids` | None — **only if the import rule in §1 held** |
| Schema | Drop the new tables | None — no existing table was altered |
| Data | Cascade from `child_profiles` | None |

The one adult-side edit (the entry-point link, §6) must also be reverted. It should be
small enough to revert by hand.
