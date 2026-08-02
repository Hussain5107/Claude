# Adult Mode regression checklist

**There is no E2E test suite.** Until one exists, this checklist is the only
defense against Kids Mode quietly breaking something adult-facing — a human
walking through it is the entire safety net (Audit §12 R1). Run it:

- Before merging any Kids Mode phase that touches a shared file (`ui.tsx`,
  `AppHeader`, `Avatar`, `Ring`, `entitlements.ts`, `theme.ts`, the dashboard
  layout).
- With the Kids Mode feature flag **on** and **off** — P1 requires identical
  behaviour either way.
- After any dependency upgrade.

Fifteen to twenty minutes on a phone-sized viewport (the app is built
mobile-first — Audit §7).

---

## 1. Auth

- [ ] Sign up with a new email. Redirected to onboarding.
- [ ] Log out. Lands on `/`, not an error page. *(Regression history: this
      broke in production once — a 307 redirect replayed the sign-out POST
      against a page that only accepts GET. Fixed, but re-check it.)*
- [ ] Log in with an existing account. Redirected to `/dashboard`.
- [ ] Visit `/dashboard` signed out. Redirected to `/login?next=%2Fdashboard`.
- [ ] Close and reopen the installed PWA after being signed in. **Still
      signed in** — this is the single most fragile flow in the app (Audit
      §5): a widened middleware matcher has broken it before by racing the
      manifest and service worker for the same single-use refresh token.

## 2. Onboarding

- [ ] Fill every field, submit. Lands on `/dashboard` with a generated
      program.
- [ ] Pick **Female** for sex. The cycle-tracking question appears.
- [ ] Pick **Male**. It does not appear.
- [ ] Leave the display name blank. The dashboard greeting still shows a
      name (falls back to the email).

## 3. Home (`/dashboard`)

- [ ] Greeting shows the right name and the right avatar (or initial, if no
      photo).
- [ ] Today's plan card links to `/dashboard/workouts`.
- [ ] Water and protein buttons update the rings without a page reload.
- [ ] The weekly bar chart reflects sets actually logged this week — not a
      guess.
- [ ] Streak badge only appears when the streak is > 0.

## 4. Workouts (`/dashboard/workouts`)

- [ ] The day strip matches the account's actual training days (3/4/5/6 per
      week, whatever the profile has).
- [ ] Selecting a rest day shows the rest-day card, not an empty list.
- [ ] Logging a set updates the streak and shows a PR flash where earned.
- [ ] "Swap exercise" offers alternatives and applies the chosen one.
- [ ] Voice coach toggle persists across a reload (localStorage).

## 5. Progress (`/dashboard/progress`)

- [ ] Charts render for an account with logged history.
- [ ] Empty state renders sensibly for a brand-new account with no sets yet.
- [ ] Uploading a progress photo works, and it appears in the list.

## 6. Gyms (`/dashboard/gyms`)

- [ ] Location permission prompt appears; granting it shows nearby gyms on
      the map.
- [ ] Denying permission shows a clear error, not a blank screen.

## 7. Settings / Profile (`/dashboard/settings`)

- [ ] Display name change is reflected on Home immediately after save.
- [ ] Theme picker (FORGE / Blue / Pink) changes colours across **every**
      tab, not just the settings screen.
- [ ] Changing training location / days-per-week regenerates the program.
- [ ] **Cycle tracking section only appears for accounts where `sex =
      'female'`.** This is the sharpest edge to re-check once Kids Mode
      exists: confirm the *kids* entry point uses the same discipline —
      never shown to an account it isn't eligible for.
- [ ] Log out button works from here too.

## 8. Cross-cutting

- [ ] Bottom tab bar shows exactly five adult tabs — unchanged by the Kids
      Mode flag being on.
- [ ] No console errors on any of the five tabs.
- [ ] Safe-area padding still looks right on an installed iPhone PWA (notch
      and home indicator).
- [ ] `/` (landing page) still renders signed-out, and still shows the
      review aggregate if `review_stats` has data.

## 9. If the Kids Mode flag is on for the test account

- [ ] A link to Kids Mode appears somewhere reachable (the one adult-side
      edit Kids Mode is allowed to make — `docs/kids-mode/03-architecture-and-data.md`
      §6).
- [ ] Every other item above is still identical to the flag being off.

---

## What this checklist does not catch

Stated honestly, not as an apology:

- **Nothing here is automated.** A tired human skips steps. This is a stopgap,
  not a replacement for real E2E coverage.
- **No cross-browser or cross-device coverage.** Whatever device the person
  running this happens to have.
- **No load or concurrency testing.** The single-use-refresh-token bug that
  broke PWA sessions was exactly this kind of failure, and this checklist
  would not have caught it before it shipped — it was found by a user hitting
  it in production.

If Kids Mode reaches meaningful usage, this checklist should be replaced by
real E2E tests (Playwright is the natural choice — no framework decision has
been made yet). That is future work, not Phase 0.
