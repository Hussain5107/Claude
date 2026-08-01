import type { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_DURATION,
  type CycleSettings,
} from "./cycle";
import type { CheckIn, Symptom } from "./cycleAdaptation";
import { hasFeature } from "./entitlements";

/**
 * Server-side helpers for cycle tracking.
 *
 * Kept out of the actions file so they can be plain functions: a "use server"
 * module may only export async server actions, and these are called from server
 * components with a Supabase client already in hand.
 */

/** Whether this account is offered cycle tracking at all. */
export function isEligible(sex: string | null | undefined, plan: string | null | undefined): boolean {
  return sex === "female" && hasFeature(plan, "cycle_adaptive");
}

/** Settings plus today's check-in, in the shapes the calculation expects. */
export async function loadCycleContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  todayIso: string,
): Promise<{ settings: CycleSettings; checkIn: CheckIn | null }> {
  const [{ data: settingsRow }, { data: checkInRow }] = await Promise.all([
    supabase.from("cycle_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("cycle_checkins")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", todayIso)
      .maybeSingle(),
  ]);

  return {
    settings: {
      enabled: settingsRow?.enabled ?? false,
      lastPeriodStart: settingsRow?.last_period_start ?? null,
      averageCycleLength: settingsRow?.average_cycle_length ?? DEFAULT_CYCLE_LENGTH,
      periodDuration: settingsRow?.period_duration ?? DEFAULT_PERIOD_DURATION,
    },
    checkIn: checkInRow
      ? {
          energy: checkInRow.energy,
          symptoms: (checkInRow.symptoms ?? []) as Symptom[],
          override: checkInRow.override,
        }
      : null,
  };
}
