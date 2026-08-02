# 02 — Product requirements, v1

Scoped deliberately small. Everything here is buildable on the constraints in
`00-principles.md`. Anything requiring an unresolved decision is marked and deferred.

---

## 1. Problem

A parent using Workout Forge has no way to give their child something to do. The adult
product is built for adults: it prescribes load, tracks estimated 1RM
(`src/lib/tracking.ts`), and asks for body weight and blood pressure. None of that
belongs in front of a nine-year-old.

**Inferred.** No repository evidence establishes user demand for this; it is a product
hypothesis from the owner. Worth stating so it is not mistaken for a validated need.

---

## 2. Who it is for

| Role | Description | Has a login |
|---|---|---|
| **Parent** | Existing Workout Forge account holder | Yes — their own |
| **Child** | Dependent record owned by a parent | **No** (D-002) |

The child is a user of the interface but never of the account. Every byte written on
their behalf is written by the parent's session.

---

## 3. In scope for v1

| # | Capability | Depends on |
|---|---|---|
| F1 | Parent creates, edits and deletes child profiles | OD-1, OD-3 |
| F2 | Deleting a child erases all of that child's data | — |
| F3 | Child-facing home screen: today's activity, simple progress | — |
| F4 | Age-banded sessions the child can work through | OD-9, OD-10, OD-11 |
| F5 | Marking a session complete | — |
| F6 | Simple reward feedback (XP or equivalent) | OD-12, OD-13 |
| F7 | Parent view of child activity | OD-14 |
| F8 | Kids Mode enrolment gated on a verified parent email | OD-4, P-004 |
| F9 | Whole feature behind a server-enforced flag | — |

## 4. Explicitly out of scope for v1

Not "later" — **out**, with a reason.

| Excluded | Reason |
|---|---|
| Child logins | D-002 |
| Progress photos of children | D-010. Permanently out of scope, not deferred. |
| Weight, BMI, body composition, or any body-measurement input for a child | Wrong for the audience regardless of what is technically possible. Adult product collects these (`profiles.weight_kg`); kids must not. |
| Load prescription, 1RM, training to failure | Requires youth-training review (OD-11) and is not a v1 need. |
| Nutrition targets or calorie figures for children | The adult calculation is Mifflin-St Jeor over adult inputs (Audit §11). Applying it to a child would be a health claim this team cannot make (P10). |
| Child-to-child anything — leaderboards, sharing, friends | Introduces cross-account data flow, which is the exact risk P2 exists to prevent. |
| Free-text entry by a child | Unmoderated text from a minor is a content-safety problem with no v1 owner. |
| Push notifications addressed to a child | Existing push is per-account (`push_subscriptions`, `supabase/schema.sql:303`). A parent nudge is possible; a child-addressed one is not in v1. |
| CMS | D-011, justified in `04` §6. |

---

## 5. Parent surface

**Route:** `/parent` (D-003)

| Screen | Contains |
|---|---|
| Child list | One card per child, add-child entry point |
| Add / edit child | Name, age band, avatar. **Not** date of birth — see `04` §3 |
| Child summary | What that child has done |
| Delete child | Explicit confirmation; cascade |

**Open (OD-14):** whether the summary is *all activity* or *a weekly digest*. These are
materially different products. A digest is usually the better one — it gives the parent
signal without turning the app into surveillance of a child's every tap — but it is the
owner's call, and it changes whether an aggregate view is sufficient (see `03` §4).

---

## 6. Child surface

**Route:** `/kids/...` (D-003, identifier form pending OD-5)

**Verified constraint:** this must not reuse `AppHeader`'s adult navigation or
`BottomTabBar` (D-006, `src/components/BottomTabBar.tsx:22`). It gets its own shell.

Principles for the screens, not a design spec:

- **Legible to a child.** Larger targets, fewer numbers, no jargon. The adult product's
  density is wrong here.
- **One obvious next action.** The adult Home screen has a hero card that is "the main
  way into a session" (`src/components/HomeClient.tsx`) — the same idea, simplified.
- **No dead ends.** A child who finishes everything gets a clear, positive end state.
- **Theme:** a kids palette via `[data-theme]`, which is a CSS block, not a component
  fork (Audit §14, `src/app/globals.css`).

### Motivation — requires a deliberate decision (OD-13)

Streaks and badges work because they create obligation. That is the mechanism, and with
children it deserves an explicit choice rather than a default:

- Is a child ever **told they lost a streak**? Recommendation: **no**. Show what they
  did, not what they broke.
- Is there a **daily cap** on rewards, so the app cannot be farmed and does not
  encourage overtraining? Recommendation: **yes**.
- Does the parent see **pressure the child feels**? A parent seeing "3 days missed"
  creates real household pressure the app authored.

**Inferred, not verified.** These are product judgements. They are recorded here so the
owner decides them consciously.

---

## 7. Non-functional requirements

| # | Requirement | Source |
|---|---|---|
| N1 | Adult Mode behaves identically, flag on or off | P1 |
| N2 | Every kids read and write is server-authorized | P2 |
| N3 | Kids Mode is removable by dropping its own files and tables | Audit §23 |
| N4 | Works as an installed PWA, safe-area aware | `src/app/layout.tsx` viewport config |
| N5 | No new runtime dependency unless justified | Audit §2 — 7 deps total |
| N6 | Adult bundle unaffected when the flag is off | Route-group separation gives this by construction |

---

## 8. Success criteria

Deliberately modest, because the honest v1 question is "does anyone use this at all".

| Metric | Why |
|---|---|
| Parents who create ≥1 child profile | Is there demand? |
| Children who complete ≥1 session | Does the child engage at all? |
| Children who complete ≥4 sessions in 14 days | Does it hold? |
| Adult-mode regressions reported | N1, and the only guard is people noticing (Audit §12 R1) |

**Not a success metric:** total time in app. Optimising a child's screen time upward is
not a goal this product should adopt.

**Measurement gap, stated honestly.** There is no analytics SDK in the repository
(Audit §2). These metrics would have to be counted with SQL against the kids tables.
That is fine at this scale, and it is the privacy-preferable option, but it means
"success" is a manual query, not a dashboard.
