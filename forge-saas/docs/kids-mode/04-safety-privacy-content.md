# 04 — Safety, privacy, content

> **This document does not make legal, medical, child-safety or provider-policy
> determinations.** It identifies where those determinations are required, who is
> qualified to make them, and what the engineering consequence of each answer is.
> Nothing here should be read as advice or as a conclusion that any approach is
> compliant.

---

## 1. Why this document gates the schema

**Verified.** Audit §12 R2 rates children's-data compliance as a High risk and states
that it determines the schema, the auth model, and whether video can be embedded. Audit
§24 places jurisdiction, video delivery, the auth model, and parent verification as the
four questions to answer **before any schema is written**.

The practical consequence: **the fields on `child_profiles` cannot be finalised until
OD-1 is answered.** Writing them first and adjusting later means altering a table that
holds children's data — the worst kind of migration to get wrong.

---

## 2. Regulatory review required — OD-1

**Open Decision. Requires qualified legal review. This team is not qualified to answer
it.**

Frameworks that *may* apply, depending on where users are:

| Framework | Where | Nature |
|---|---|---|
| COPPA | United States | Children's online privacy; addresses parental consent and data collection |
| GDPR Article 8 | EU/EEA | Age of consent for information-society services; varies by member state |
| UK Age Appropriate Design Code | United Kingdom | Design standards for services likely accessed by children |
| UAE PDPL | United Arab Emirates | Personal data protection; the owner is UAE-based |

**Questions for legal review, phrased so the answers are actionable:**

1. Which jurisdictions do we intend to serve, and can we restrict to fewer?
2. What is the minimum age, and what happens if a parent enters one below it?
3. Does verified parental email constitute adequate consent in each jurisdiction, or is
   a stronger mechanism required? *(This determines whether P-004 is sufficient.)*
4. What retention limits apply, and what deletion rights must be exposed?
5. Does any of this change if the feature is free rather than paid?

**Engineering consequences, so the answers can be priced:**

| If the answer is… | Then… |
|---|---|
| Verified email is sufficient | P-004 as designed |
| A stronger consent mechanism is required | Enrolment flow is substantially larger; re-scope |
| Retention limits apply | An automated deletion job is needed — the app has one cron route today (`/api/cron/reminders`), so the mechanism exists |
| Jurisdiction can be restricted | Materially less to satisfy; worth asking early |

---

## 3. Data minimisation

**This part is an engineering position, not a legal one**, and it holds regardless of
how OD-1 is answered: *data you do not hold cannot leak, cannot be misused, and does not
need a retention policy.*

### Store

| Field | Why the minimum form |
|---|---|
| Display name | A first name or nickname. No surname needed. |
| **Age band, or birth year — not full date of birth** | The app needs to pick a session tier. A precise DOB for a minor is more personal data than the feature requires. |
| Avatar | **Recommend a chosen preset, not an uploaded photograph.** *Inferred.* |
| Activity records | What the feature exists to show |

### Do not store — permanently, not deferred

**Verified.** D-010, Audit §19.

| Excluded | Reason |
|---|---|
| Photographs of children | `progress_photos` must never extend to children. Out of scope permanently. |
| Weight, height, BMI, body composition | The adult product collects these (`profiles.weight_kg`, `height_cm`). Applying that to a child is wrong for the audience, regardless of legality. |
| Blood pressure or pulse | `health_metrics` is adult-only |
| Free-text written by a child | Unmoderated minor-authored text has no v1 owner |
| Precise location | The app has a gyms feature that uses geolocation once without storing it (`/api/gyms`); nothing comparable belongs in Kids Mode |

**Avatar decision is a real fork.** Preset avatars remove an entire class of problem —
no image upload from a minor, no storage bucket policy for children, no moderation
question. If uploaded photos are wanted, that needs its own review. *Inferred.*

---

## 4. Video content — OD-2

**Open Decision. Requires review of the provider's current terms — this document does
not state what any provider permits.**

**Verified context.** The adult library already carries curated `videoUrl` values per
exercise (Audit §11), so the *shape* of a curated media list is established.

**The question is delivery, not curation.** A standard embed loads a third-party player
into a child-facing page, which may bring recommendations, related-video surfacing, and
advertising into the experience — and may involve data collection by that provider.
Whether that is acceptable is a policy and legal question.

| Option | Trade-off |
|---|---|
| Standard embed | Simplest; brings the most third-party surface |
| Privacy-enhanced embed with related videos disabled | Reduces surface; **actual behaviour must be verified against current provider terms, not assumed** |
| Link out to the provider's app | Leaves our surface entirely; the child ends up in a general-purpose video app, which may be worse |
| Self-host short clips | Full control; production and storage cost; Supabase free tier has no backups (Audit §12 R4) |

**The operational question is the one usually forgotten:** a curated allow-list is not a
one-time task. Videos get deleted, channels change hands, content changes. **A curated
list needs a named owner and a review cadence, or it silently rots.** Audit §24 Q2 raises
this. If no one will own it, that argues for self-hosting or for dropping video from v1.

**Recommendation pending OD-2:** if this cannot be resolved cleanly, **ship v1 without
video.** It is not load-bearing for F1–F7 (`02` §3).

---

## 5. Exercise safety — OD-11

**Open Decision. Requires review by a qualified person. This team cannot sign it off,
and this document makes no medical or developmental claims.**

**Verified precedent.** The adult product declines to make claims it cannot support:
`src/components/HomeClient.tsx:18-25` refuses to display data the app does not measure,
and `src/lib/cycleAdaptation.ts` states plainly that the research is mixed. Kids Mode
inherits that standard (P10).

**What review must cover:**

1. Every movement in the kids library, for age-appropriateness.
2. Volume and intensity per age band.
3. Whether any external loading appears at all in v1 (**recommend: no** — *Inferred*).
4. Whether an adult must be present, and whether the app should say so.
5. What the app must **not** claim. No "builds strong bones", no "improves focus", no
   developmental benefit claims of any kind.

**Bodies that publish youth resistance-training guidance** — offered as starting points
for the qualified reviewer, **not as an endorsement or a claim of compliance**: NSCA,
AAP, UKSCA, WHO physical-activity guidance for children and adolescents.

**OD-11 must name a person.** "We'll check the guidelines" is not a sign-off.

---

## 6. Content pipeline — no CMS in v1

**D-011. Inferred, with the revisit trigger stated.**

The instruction was not to assume a CMS and to justify one only if v1 volume, editorial
workflow, or non-developer publishing warrant the operational complexity. Assessed:

| Test | v1 reality | Verdict |
|---|---|---|
| **Volume** | Roughly 30–60 exercises and a handful of sessions per age band. The adult library is 99 exercises across three TypeScript modules (`src/lib/exercises/`, ~2,000 LOC) and is maintained comfortably. | Below the threshold |
| **Editorial workflow** | One author. No draft/review/publish states, no scheduling, no localisation. | No workflow to support |
| **Non-developer publishing** | Nobody but the developer publishes today. | Not needed |
| **Change frequency** | Content changes with releases, not daily. | Not needed |

**Against a CMS in v1:** it adds a service, a schema, credentials, a cost, and a second
place where child-facing content can change **without passing through code review** —
which directly undermines OD-11's sign-off requirement. A TypeScript data module is
type-checked, diffable, and reviewable in a pull request. For content a qualified person
must approve, that is a feature.

**Revisit when any of these becomes true:**

1. A non-developer needs to publish or correct content.
2. Video review becomes a recurring operational task with a named non-developer owner
   (§4).
3. Content volume passes roughly 200 items, or localisation begins.
4. Content must change without a deploy.

**Recommendation:** follow the existing pattern — a typed data module under
`src/lib/kids/`, images in `public/images/` named after their slug, exactly as the adult
library does.

---

## 7. Safety properties the build must hold

| # | Property | Enforced by |
|---|---|---|
| S1 | A child's data is readable only by their parent | RLS `auth.uid() = parent_user_id`; proven by P-005's test |
| S2 | No child-to-child data flow of any kind | No shared tables, no leaderboards (`02` §4) |
| S3 | A PIN is never a security boundary | P2 — stated in every spec that mentions it |
| S4 | Deleting a child erases their data | Cascade; `00` "done" criterion 2 |
| S5 | No body measurement or photograph of a child | §3, D-010 |
| S6 | No unmoderated child-authored text | `02` §4 |
| S7 | Rewards cannot be farmed | Daily cap, OD-13 |
| S8 | Nothing outside the allow-list can appear | Curated list, §4 |

---

## 8. What this document does not settle

Stated plainly so it is not mistaken for closure:

- **Whether any approach here is compliant anywhere.** Requires legal review (OD-1).
- **Whether any video delivery method is permitted.** Requires provider-terms review
  (OD-2).
- **Whether any exercise is appropriate for any age.** Requires qualified youth-fitness
  review (OD-11).
- **Whether verified email is adequate parental consent.** Legal question (OD-1 Q3).

Engineering can proceed on Phase 0 safeguards — repository consolidation, backups,
migrations, tests — because none of those depend on these answers. **Everything that
touches a child's data does.**
