/**
 * What a plan includes.
 *
 * One place to answer "can this account use X", so features check an
 * entitlement rather than a plan string scattered through components. Today
 * every feature is available on the free plan — FORGE has no paid tier — but
 * when one exists, moving a feature behind it is a change to this file and
 * nothing else.
 */

export type Plan = "free" | "pro";

export type Feature =
  /** Cycle-adaptive training: phase-aware suggestions and daily check-ins. */
  | "cycle_adaptive"
  /** Export training history for an AI assistant to read. */
  | "ai_export"
  /** Kids Mode: parent-managed child profiles and a separate child-facing surface. */
  | "kids_mode";

/**
 * Plans a feature is available on. Listing "free" is what makes it free —
 * remove it to put a feature behind Pro.
 *
 * kids_mode ships as [] deliberately — this is the kill switch half of the two
 * layers docs/kids-mode/00-principles.md P9 requires. Closed here means closed
 * for every account regardless of plan, with no deploy needed to open it, and
 * regardless of the second layer (profiles.kids_mode_enabled, the per-account
 * allow-list — see the Phase 1 migration). Both layers must be open for a given
 * account to actually reach /kids or /parent; see hasKidsModeAccess below.
 */
const AVAILABLE_ON: Record<Feature, Plan[]> = {
  cycle_adaptive: ["free", "pro"],
  ai_export: ["free", "pro"],
  kids_mode: [],
};

export function hasFeature(plan: string | null | undefined, feature: Feature): boolean {
  const p = (plan === "pro" ? "pro" : "free") as Plan;
  return AVAILABLE_ON[feature].includes(p);
}

/**
 * Both layers Kids Mode requires, combined: the global kill switch (this
 * file) AND the per-account allow-list column (profiles.kids_mode_enabled).
 * Checked server-side wherever a Kids Mode route or action decides whether to
 * proceed — docs/kids-mode/00-principles.md P9.
 */
export function hasKidsModeAccess(
  plan: string | null | undefined,
  kidsModeEnabled: boolean | null | undefined,
): boolean {
  return hasFeature(plan, "kids_mode") && kidsModeEnabled === true;
}
