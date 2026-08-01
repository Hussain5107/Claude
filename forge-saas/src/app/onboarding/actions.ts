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

  const age = Number(formData.get("age"));
  const sex = formData.get("sex") as Sex;
  const heightCm = Number(formData.get("heightCm"));
  const weightKg = Number(formData.get("weightKg"));
  const goal = formData.get("goal") as Goal;
  const experience = formData.get("experience") as ExperienceLevel;
  const trainingLocation = (formData.get("trainingLocation") as string) || "gym";
  const hasDumbbells = (formData.get("hasDumbbells") as string) || "yes";
  const daysPerWeek = Number(formData.get("daysPerWeek")) || 6;

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
      day_offset: deriveDayOffset(user.id),
      training_location: trainingLocation,
      has_dumbbells_at_home: hasDumbbellsAtHome,
      days_per_week: daysPerWeek,
      onboarded: true,
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
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
