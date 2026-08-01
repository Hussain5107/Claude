"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateProgram } from "@/lib/exercises/generator";
import type { DaysPerWeek, TrainingLocation } from "@/lib/exercises/types";
import { THEME_NAMES, type ThemeName } from "@/lib/theme";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export interface UpdateProfileInput {
  displayName: string | null;
  dateOfBirth: string | null;
  country: string | null;
  phoneNumber: string | null;
  hasDiabetes: boolean;
  hasHighBloodPressure: boolean;
  otherHealthNotes: string | null;
  waterReminderEnabled: boolean;
  waterReminderHour: number;
  workoutReminderEnabled: boolean;
  workoutReminderHour: number;
}

export async function updateProfile(input: UpdateProfileInput): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();

  // Trimmed, and blank stored as null rather than "" — the dashboard treats
  // null as "fall back to the email", and an empty string would leave the
  // greeting with no name at all.
  const displayName = input.displayName?.trim() || null;
  if (displayName && displayName.length > 30) {
    return { error: "That name is a bit long — 30 characters or fewer." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      date_of_birth: input.dateOfBirth || null,
      country: input.country || null,
      phone_number: input.phoneNumber || null,
      has_diabetes: input.hasDiabetes,
      has_high_blood_pressure: input.hasHighBloodPressure,
      other_health_notes: input.otherHealthNotes || null,
      water_reminder_enabled: input.waterReminderEnabled,
      water_reminder_hour: input.waterReminderHour,
      workout_reminder_enabled: input.workoutReminderEnabled,
      workout_reminder_hour: input.workoutReminderHour,
    })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { error: null };
}

/** Location, equipment and weekly frequency all change which exercises the plan
 *  contains, so they share one action and one regeneration rather than three. */
export async function updateProgramSettings(
  trainingLocation: TrainingLocation,
  hasDumbbellsAtHome: boolean,
  daysPerWeek: DaysPerWeek,
): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("age, sex, height_cm, weight_kg, goal, experience")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) return { error: fetchError?.message ?? "Couldn't load your profile." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      training_location: trainingLocation,
      has_dumbbells_at_home: hasDumbbellsAtHome,
      days_per_week: daysPerWeek,
    })
    .eq("id", userId);

  if (updateError) return { error: updateError.message };

  const program = generateProgram({
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.height_cm,
    weightKg: profile.weight_kg,
    goal: profile.goal,
    experience: profile.experience,
    trainingLocation,
    hasDumbbellsAtHome,
    daysPerWeek,
  });

  const { error: programError } = await supabase
    .from("programs")
    .upsert({ user_id: userId, program, created_at: new Date().toISOString() });

  if (programError) return { error: programError.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateAvatarUrl(url: string): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateTheme(theme: ThemeName): Promise<{ error: string | null }> {
  if (!THEME_NAMES.includes(theme)) return { error: "Unknown theme." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("profiles").update({ theme }).eq("id", userId);
  if (error) return { error: error.message };
  // The theme is applied by the signed-in layout, so every screen under it has
  // to be re-rendered for the new colours to take.
  revalidatePath("/dashboard", "layout");
  return { error: null };
}

export async function savePushSubscription(
  endpoint: string,
  p256dh: string,
  authKey: string,
): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint, p256dh, auth_key: authKey }, { onConflict: "endpoint" });
  return { error: error?.message ?? null };
}

export async function logHealthMetric(
  logDate: string,
  systolic: number | null,
  diastolic: number | null,
  pulse: number | null,
  notes: string,
): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("health_metrics").insert({
    user_id: userId,
    log_date: logDate,
    systolic,
    diastolic,
    pulse,
    notes: notes.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { error: null };
}
