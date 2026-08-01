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
  | "ai_export";

/**
 * Plans a feature is available on. Listing "free" is what makes it free —
 * remove it to put a feature behind Pro.
 */
const AVAILABLE_ON: Record<Feature, Plan[]> = {
  cycle_adaptive: ["free", "pro"],
  ai_export: ["free", "pro"],
};

export function hasFeature(plan: string | null | undefined, feature: Feature): boolean {
  const p = (plan === "pro" ? "pro" : "free") as Plan;
  return AVAILABLE_ON[feature].includes(p);
}
