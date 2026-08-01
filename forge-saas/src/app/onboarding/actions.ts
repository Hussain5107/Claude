"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateProgram } from "@/lib/exercises/generator";
import type {
  DaysPerWeek,
  ExperienceLevel,
  Goal,
  Sex,
  TrainingLocation,
} from "@/lib/exercises/types";
import { deriveDayOffset } from "@/lib/dayRotation";
import { THEME_NAMES, suggestedTheme, type ThemeName } from "@/lib/theme";
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_DURATION } from "@/lib/cycle";

export interface OnboardingState {
  error?: string;
}

export async function submitOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName = ((formData.get("displayName") as string) || "").trim().slice(0, 30);
  const age = Number(formData.get("age"));
  const sex = formData.get("sex") as Sex;
  const heightCm = Number(formData.get("heightCm"));
  const weightKg = Number(formData.get("weightKg"));
  const goal = formData.get("goal") as Goal;
  const experience = formData.get("experience") as ExperienceLevel;
  const trainingLocation = (formData.get("trainingLocation") as string) || "gym";
  const hasDumbbells = (formData.get("hasDumbbells") as string) || "yes";
  const daysPerWeek = Number(formData.get("daysPerWeek")) || 6;
  const themeInput = formData.get("theme") as ThemeName | null;
  const wantsCycleTracking = sex === "female" && formData.get("cycleTracking") === "yes";

  if (
    !age || age < 13 || age > 100 ||
    !["male", "female"].includes(sex) ||
    !heightCm || heightCm < 100 || heightCm > 250 ||
    !weightKg || weightKg < 30 || weightKg > 300 ||
    !["muscle", "strength", "fat_loss", "general_fitness"].includes(goal) ||
    !["beginner", "intermediate", "advanced"].includes(experience) ||
    !["gym", "home"].includes(trainingLocation) ||
    ![3, 4, 5, 6].includes(daysPerWeek)
  ) {
    return { error: "Please fill in every field with a valid value." };
  }

  // Falls back to the theme the sex implies, so a form submitted without the
  // field (old cached page, JS disabled) still lands somewhere sensible.
  const theme = themeInput && THEME_NAMES.includes(themeInput) ? themeInput : suggestedTheme(sex);

  const hasDumbbellsAtHome = trainingLocation === "gym" ? true : hasDumbbells === "yes";
  const profile = {
    age,
    sex,
    heightCm,
    weightKg,
    goal,
    experience,
    trainingLocation: trainingLocation as TrainingLocation,
    hasDumbbellsAtHome,
    daysPerWeek: daysPerWeek as DaysPerWeek,
  };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      age,
      sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      goal,
      experience,
      display_name: displayName || null,
      day_offset: deriveDayOffset(user.id),
      training_location: trainingLocation,
      has_dumbbells_at_home: hasDumbbellsAtHome,
      days_per_week: daysPerWeek,
      theme,
      onboarded: true,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  // Cycle tracking is opt-in and separate from the profile row, so a failure
  // here shouldn't cost the user their whole onboarding — the program is what
  // they came for, and this is editable in Settings either way.
  if (wantsCycleTracking) {
    const lastPeriodStart = (formData.get("lastPeriodStart") as string) || null;
    const cycleLength = clampInt(Number(formData.get("cycleLength")), 20, 45, DEFAULT_CYCLE_LENGTH);
    const periodDuration = clampInt(Number(formData.get("periodDuration")), 1, 10, DEFAULT_PERIOD_DURATION);

    await supabase.from("cycle_settings").upsert(
      {
        user_id: user.id,
        enabled: true,
        // A future date would make the day count negative; drop it and let them
        // fill it in properly from Settings.
        last_period_start:
          lastPeriodStart && new Date(lastPeriodStart + "T00:00:00").getTime() <= Date.now()
            ? lastPeriodStart
            : null,
        average_cycle_length: cycleLength,
        period_duration: periodDuration,
      },
      { onConflict: "user_id" },
    );
  }

  const program = generateProgram(profile);

  const { error: programError } = await supabase
    .from("programs")
    .upsert({ user_id: user.id, program, created_at: new Date().toISOString() });

  if (programError) {
    return { error: programError.message };
  }

  redirect("/dashboard");
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
