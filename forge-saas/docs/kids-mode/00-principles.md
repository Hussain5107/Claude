# 00 — Principles

The constraints Kids Mode is built under. These are not preferences. A design that
violates one of these is wrong regardless of how convenient it is.

---

## P1 — Adult Mode is production and does not change

**Verified.** Audit §15 lists nine things that must never change; Audit §12 R1 records
that there are zero automated tests, so a regression in adult code would be caught by a
human noticing, not by CI.

Concretely, Kids Mode must not touch:

| Asset | Evidence | Why |
|---|---|---|
| `src/middleware.ts` matcher | Audit §5 | Load-bearing: excluding `sw.js` and `manifest.webmanifest` is what stops a PWA cold start racing three requests to redeem one single-use refresh token |
| Existing `profiles` columns | Audit §15.3 | 17 columns added additively; renaming or retyping breaks live reads |
| `src/lib/exercises/*` adult path | Audit §15.4 | The generator has one consumer today and no tests |
| `programs.program` JSONB shape | Audit §15.7 | Live user data is stored in it |
| `/dashboard/*` routes, `BottomTabBar` contents | Audit §15.6, `src/components/BottomTabBar.tsx:22` | Adult navigation is finished |
| Existing RLS policies | Audit §15.5 | 41 policies, all own-row |
| `/` static rendering | Audit §15.8 | Making it dynamic costs money and speed |

**Test of compliance:** if `git diff` on a Kids Mode branch touches any file under
`src/app/dashboard/`, `src/lib/exercises/`, or `src/middleware.ts`, the change needs a
written justification, not a shrug.

---

## P2 — Authorization is server-enforced or it does not exist

**Verified.** Audit §5: there are no roles; authorization is entirely "is this row
yours", enforced by 41 RLS policies of the form `auth.uid() = user_id`. Route
protection is doubled — middleware redirects, and every page re-checks `getUser()`.

For Kids Mode this means:

- Every kids row carries an owner column, and every policy checks `auth.uid()`.
- Every Server Action re-validates that the caller owns the child it is acting on.
  A hidden button is not a permission.
- **A PIN to leave kid mode is a UX feature, never a security boundary.** It runs on
  the client, a child can reload the page, and it must never be the only thing standing
  between a session and parent data.

---

## P3 — Children are subjects, not accounts

**Verified as the audit's recommendation** (Audit §16), **Open Decision as policy**
(Audit §24 Q3, restated in `01-decisions.md` as D-002).

The parent holds the login. Children are dependent records owned by that login. No
child email, no child password, no child session.

This keeps RLS trivially simple — every kids policy remains `auth.uid() =
parent_user_id`, the same shape as the existing 41 — and it means deleting a child
removes their data in one cascade.

---

## P4 — Kids data lives in its own tables

**Verified.** `supabase/schema.sql:54` — `programs.user_id` is a **primary key**, so one
login can hold exactly one program. `supabase/schema.sql:85` — `progress` is unique on
`(user_id, log_date, exercise_slug)`, so two children training the same movement on the
same day under one parent would collide.

Widening those tables with a nullable `child_id` would:

- turn every existing own-row policy into a two-branch condition (P2 risk),
- put child rows inside tables that adult screens read, so one missed filter leaks,
- still require dropping the `programs` primary key.

New tables keep adult queries provably unchanged, which is what P1 demands.

---

## P5 — Kids domain logic is separate from adult domain logic

**Verified.** Audit §11: `generateProgram(profile)` is a pure function over a value
object, with three data libraries selected by equipment.

Kids logic goes in `src/lib/kids/*` as a **sibling**, not a branch. No `if (isKid)`
inside `prescribeExercise`.

The reason is not tidiness. It is that children are not scaled-down adults: the
prescription rules genuinely differ, and any conditional inside the adult generator
means an adult-facing regression is one careless edit away — in a module with no tests
(Audit §12 R1).

**Import direction is one-way and enforced:**

```
src/lib/kids/*  ──may import──►  src/lib/exercises/types.ts, splits.ts
src/lib/kids/*  ──must NOT import──►  src/app/*
adult code      ──must NOT import──►  src/lib/kids/*, src/components/kids/*
```

Audit §23 notes the clean rollback depends entirely on this holding.

---

## P6 — Share primitives, not screens

**Verified.** `src/components/ui.tsx` exports seven theme-driven primitives — `Card`,
`Button`, `Label`, `Input`, `Select`, `ErrorText`, `Checkbox` (lines 3, 12, 26, 35, 44,
53, 58). Audit §9 records that the four `*Client.tsx` screens run 396–602 lines and mix
layout, state and action calls.

Reusable: `ui.tsx`, `Avatar`, `Ring`, `AppHeader`, `InstallAppPrompt`.
Not reusable: `DashboardClient`, `HomeClient`, `ExerciseCard`, `SettingsClient`,
`ProgressClient`, and the whole cycle-tracking set.

`src/app/dashboard/layout.tsx:34,39` injects `data-theme` and `<BottomTabBar />` into
everything beneath it — which is exactly why kids routes are siblings of `/dashboard`
and not children of it (P7).

---

## P7 — Kids and Parent routes are siblings of the adult dashboard

**Verified.** `src/app/dashboard/layout.tsx:39` renders the adult tab bar for every
nested route, and `src/components/BottomTabBar.tsx:22` hardcodes the five adult tabs.
Nesting kids routes under `/dashboard` would force conditionals into the adult shell,
violating P1.

```
/dashboard/*        adult, untouched
/parent             parent surface
/kids/[...]         child-facing surface
```

---

## P8 — Mutations are Server Actions

**Verified.** Audit §8: there is no application API. 23 Server Actions across five
`actions.ts` files, all shaped `requireUser()` → validate → write with the caller's own
client → `revalidatePath` → return `{ error: string | null }`.

Kids Mode adds new `actions.ts` files in new route folders. It does **not** add a REST
API. `03-architecture-and-data.md` §5 works through why, rather than asserting it.

---

## P9 — Ship dark, behind a server-checked flag

**Verified.** `src/lib/entitlements.ts:13,23,28` already provides
`hasFeature(plan, feature)` over an `AVAILABLE_ON` map.

Kids Mode ships with the flag closed and is opened per account. The flag is checked on
the server in three places — the route layouts, the entry point that reveals the link,
and **every Server Action**. Checking it only in the UI would violate P2.

---

## P10 — Claims are sized to the evidence

The adult product already holds this line: it refuses to display step counts or body-fat
readings it cannot measure (`src/components/HomeClient.tsx:18-25`), and the
cycle-tracking feature states plainly that the research is mixed
(`src/lib/cycleAdaptation.ts` header).

Kids Mode inherits that standard, and needs it more:

- **No medical or developmental claims.** Not "builds strong bones", not "improves
  focus". Where youth-training guidance is cited, it is cited as guidance under review
  (see `04-safety-privacy-content.md`), never as this team's determination.
- **No legal conclusions.** These documents identify where COPPA, GDPR Article 8 and the
  UAE PDPL *may* apply. They do not conclude what is or is not compliant. That requires
  qualified legal review.
- **No fabricated progress.** If the app does not measure it, it does not show it.

---

## What "done" means for v1

A Kids Mode release is not done until all of these hold:

1. Adult Mode behaves identically with the flag on and off — verified by walking the
   adult flows, since there is no test suite to do it (Audit §12 R1).
2. Deleting a child profile removes every row belonging to that child.
3. A parent cannot read or write another parent's child, proven by a test that tries.
4. The flag closed means kids routes are unreachable, including by direct URL.
5. Every kids Server Action rejects a caller who does not own the child.
6. No child-facing screen depends on a client-side check for correctness.
