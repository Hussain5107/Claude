"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_DURATION } from "@/lib/cycle";
import { SYMPTOMS, type EnergyLevel, type Symptom } from "@/lib/cycleAdaptation";
import { isEligible } from "@/lib/cycleServer";

/**
 * Cycle tracking data.
 *
 * Every read and write goes through the signed-in user's own client, so row
 * level security is doing the access control — these actions never take a user
 * id from the caller, and a user can only ever touch their own rows.
 *
 * Turning tracking on additionally checks eligibility, so the feature can't be
 * switched on for an account it isn't offered to. The check-in write doesn't
 * repeat that lookup: a check-in row is meaningless without settings, and RLS
 * already confines it to the writer.
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export interface SaveCycleInput {
  enabled: boolean;
  lastPeriodStart: string | null;
  averageCycleLength: number;
  periodDuration: number;
}

export async function saveCycleSettings(input: SaveCycleInput): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("sex, plan")
    .eq("id", userId)
    .single();
  if (!isEligible(profile?.sex, profile?.plan)) {
    return { error: "Cycle tracking isn't available on this account." };
  }

  const length = Math.round(input.averageCycleLength) || DEFAULT_CYCLE_LENGTH;
  const duration = Math.round(input.periodDuration) || DEFAULT_PERIOD_DURATION;

  if (length < 20 || length > 45) {
    return { error: "Cycle length should be between 20 and 45 days." };
  }
  if (duration < 1 || duration > 10) {
    return { error: "Period length should be between 1 and 10 days." };
  }
  if (input.lastPeriodStart) {
    const start = new Date(input.lastPeriodStart + "T00:00:00");
    if (Number.isNaN(start.getTime())) return { error: "That date doesn't look right." };
    if (start.getTime() > Date.now()) return { error: "That start date is in the future." };
  }

  const { error } = await supabase.from("cycle_settings").upsert(
    {
      user_id: userId,
      enabled: input.enabled,
      last_period_start: input.lastPeriodStart,
      average_cycle_length: length,
      period_duration: duration,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return { error: null };
}

/**
 * Erases everything the user entered — settings and every check-in. Turning
 * tracking off leaves the numbers behind; this is the button that doesn't.
 */
export async function deleteCycleData(): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();

  const { error: checkInError } = await supabase.from("cycle_checkins").delete().eq("user_id", userId);
  if (checkInError) return { error: checkInError.message };

  const { error } = await supabase.from("cycle_settings").delete().eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { error: null };
}

export async function saveCheckIn(
  logDate: string,
  energy: EnergyLevel | null,
  symptoms: string[],
  override: "follow" | "push" | null,
): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();

  if (energy !== null && !["low", "medium", "high"].includes(energy)) {
    return { error: "Unknown energy level." };
  }
  // Drop anything not in the known list rather than storing free text — this
  // table should never accumulate arbitrary strings about someone's health.
  const cleaned = symptoms.filter((s): s is Symptom => SYMPTOMS.includes(s as Symptom));

  const { error } = await supabase.from("cycle_checkins").upsert(
    {
      user_id: userId,
      log_date: logDate,
      energy,
      symptoms: cleaned,
      override,
      logged_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date" },
  );

  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");
  return { error: null };
}
