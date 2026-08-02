# Workout Forge — Kids Mode

Planning documentation. **No implementation has begun.** Nothing outside
`docs/kids-mode/` has been created or modified by this work.

## Evidence baseline

Every claim in these documents traces to one of two sources:

| Source | Citation form |
|---|---|
| `docs/architecture-audit.md` | "Audit §7" |
| The repository itself | `path/to/file.ts:LINE` |

Where neither supports a statement, it is marked **Inferred** or **Open Decision** and
must not be treated as settled.

## Confidence markers

Every recommendation in these documents carries one:

| Marker | Meaning |
|---|---|
| **Verified** | Supported by a cited audit section or a cited file and line. Safe to build on. |
| **Inferred** | A reasonable engineering judgement from verified facts, but not itself verified. Challengeable. |
| **Open Decision** | Requires a named human to decide. **Blocks the work that depends on it.** |

## Documents

| File | Purpose | Read if you are |
|---|---|---|
| `00-principles.md` | The non-negotiables, and what "done" means | Everyone, first |
| `01-decisions.md` | Decision register, including four proposals that differ from the audit | The owner. **Approval needed here.** |
| `02-product-prd.md` | What Kids Mode is, scoped to v1 | Product, design |
| `03-architecture-and-data.md` | Routes, modules, data model, why not REST | Engineering |
| `04-safety-privacy-content.md` | Child safety, data protection, content sourcing | The owner, and whoever reviews legally |
| `05-delivery-roadmap.md` | Phases, gates, rollback | Everyone |

## Status

| Item | State |
|---|---|
| Architecture audit | Complete (`docs/architecture-audit.md`) |
| Kids Mode planning | **This directory — awaiting approval** |
| Phase 0 engineering safeguards | **Blocked** — see `01-decisions.md` |
| Implementation | Not started |

## What must happen before any code

Four decisions gate Phase 0. They are listed in full at the end of `01-decisions.md`
and summarised in `05-delivery-roadmap.md`. Two of them (jurisdiction, video delivery)
require review by someone qualified in the relevant field — not by this team.
