"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { estimated1RM, updateStreak, type StreakState } from "@/lib/tracking";
import { libraryFor, prescribeExercise } from "@/lib/exercises/generator";
import { findAlternatives, rankAlternatives } from "@/lib/exercises/alternatives";
import type { MatchQuality } from "@/lib/exercises/alternatives";
import type { GeneratedProgram, UserProfile } from "@/lib/exercises/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export async function toggleExerciseDone(
  logDate: string,
  dayNumber: number,
  exerciseSlug: string,
  done: boolean,
) {
  const { supabase, userId } = await requireUser();

  await supabase.from("progress").upsert(
    {
      user_id: userId,
      log_date: logDate,
      day_number: dayNumber,
      exercise_slug: exerciseSlug,
      done,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date,exercise_slug" },
  );

  revalidatePath("/dashboard");
}

export async function saveExerciseNote(
  logDate: string,
  dayNumber: number,
  exerciseSlug: string,
  note: string,
) {
  const { supabase, userId } = await requireUser();

  await supabase.from("progress").upsert(
    {
      user_id: userId,
      log_date: logDate,
      day_number: dayNumber,
      exercise_slug: exerciseSlug,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,log_date,exercise_slug" },
  );

  revalidatePath("/dashboard");
}

export interface LogSetResult {
  isNewPR: boolean;
  estimated1RM: number;
  streak: { current: number; longest: number };
}

export async function logSet(
  logDate: string,
  dayNumber: number,
  exerciseSlug: string,
  exerciseName: string,
  setNumber: number,
  weightKg: number,
  reps: number,
  rpe: number | null,
): Promise<LogSetResult> {
  const { supabase, userId } = await requireUser();

  await supabase.from("workout_sets").insert({
    user_id: userId,
    log_date: logDate,
    day_number: dayNumber,
    exercise_slug: exerciseSlug,
    exercise_name: exerciseName,
    set_number: setNumber,
    weight_kg: weightKg,
    reps,
    rpe,
  });

  // PR detection: compare against the best estimated 1RM ever logged for
  // this exercise.
  const oneRM = estimated1RM(weightKg, reps);
  let isNewPR = false;

  if (oneRM > 0) {
    const { data: bestRows } = await supabase
      .from("personal_records")
      .select("estimated_1rm")
      .eq("user_id", userId)
      .eq("exercise_slug", exerciseSlug)
      .order("estimated_1rm", { ascending: false })
      .limit(1);

    const currentBest = bestRows?.[0]?.estimated_1rm ?? 0;
    if (oneRM > currentBest) {
      isNewPR = true;
      await supabase.from("personal_records").insert({
        user_id: userId,
        exercise_slug: exerciseSlug,
        exercise_name: exerciseName,
        weight_kg: weightKg,
        reps,
        estimated_1rm: oneRM,
      });
    }
  }

  // Streak update (idempotent per calendar day).
  const { data: streakRow } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const prevState = {
    currentStreak: streakRow?.current_streak ?? 0,
    longestStreak: streakRow?.longest_streak ?? 0,
    lastWorkoutDate: streakRow?.last_workout_date ?? null,
    totalWorkouts: streakRow?.total_workouts ?? 0,
  };
  const nextState = updateStreak(prevState, logDate);

  await supabase.from("streaks").upsert({
    user_id: userId,
    current_streak: nextState.currentStreak,
    longest_streak: nextState.longestStreak,
    last_workout_date: nextState.lastWorkoutDate,
    total_workouts: nextState.totalWorkouts,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/progress");

  return {
    isNewPR,
    estimated1RM: oneRM,
    streak: { current: nextState.currentStreak, longest: nextState.longestStreak },
  };
}

export async function getStreak(): Promise<StreakState> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase.from("streaks").select("*").eq("user_id", userId).maybeSingle();
  return {
    currentStreak: data?.current_streak ?? 0,
    longestStreak: data?.longest_streak ?? 0,
    lastWorkoutDate: data?.last_workout_date ?? null,
    totalWorkouts: data?.total_workouts ?? 0,
  };
}

export interface AlternativeOption {
  slug: string;
  name: string;
  equip: string;
  primary: string[];
  difficulty: string;
  /** How closely this replaces the original, so the UI can say so plainly
   *  instead of implying every option is equivalent. */
  match: MatchQuality;
}

/** The user's profile in the shape the exercise generator expects. */
async function loadUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "age, sex, height_cm, weight_kg, goal, experience, training_location, has_dumbbells_at_home, days_per_week",
    )
    .eq("id", userId)
    .single();
  if (!data) return null;
  return {
    age: data.age,
    sex: data.sex,
    heightCm: data.height_cm,
    weightKg: data.weight_kg,
    goal: data.goal,
    experience: data.experience,
    trainingLocation: data.training_location ?? "gym",
    hasDumbbellsAtHome: data.has_dumbbells_at_home ?? true,
    daysPerWeek: data.days_per_week ?? 6,
  };
}

/** Replacements offered for one exercise on one day. Computed server-side so the
 *  whole exercise library doesn't have to ship to the browser. */
export async function getAlternatives(
  dayNumber: number,
  exerciseSlug: string,
): Promise<{ options: AlternativeOption[]; error: string | null }> {
  const { supabase, userId } = await requireUser();

  const profile = await loadUserProfile(supabase, userId);
  if (!profile) return { options: [], error: "Couldn't load your profile." };

  const { data: programRow } = await supabase
    .from("programs")
    .select("program")
    .eq("user_id", userId)
    .single();
  if (!programRow) return { options: [], error: "Couldn't load your program." };

  const program = programRow.program as GeneratedProgram;
  const day = program.days.find((d) => d.dayNumber === dayNumber);
  const current = day?.exercises.find((e) => e.slug === exerciseSlug);
  if (!day || !current) return { options: [], error: "That exercise isn't in today's plan." };

  // Exclude whatever is already scheduled today, so a swap can't create a duplicate.
  const alreadyToday = day.exercises.map((e) => e.slug);
  const options = rankAlternatives(libraryFor(profile), current, alreadyToday).map(
    ({ exercise, match }) => ({
      slug: exercise.slug,
      name: exercise.name,
      equip: exercise.equip,
      primary: exercise.primary as string[],
      difficulty: exercise.difficulty,
      match,
    }),
  );

  return { options, error: null };
}

/** Swaps one exercise for another in the stored program, re-prescribing sets,
 *  reps and rest for the slot it lands in. */
export async function swapExercise(
  dayNumber: number,
  currentSlug: string,
  replacementSlug: string,
): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();

  const profile = await loadUserProfile(supabase, userId);
  if (!profile) return { error: "Couldn't load your profile." };

  const { data: programRow } = await supabase
    .from("programs")
    .select("program")
    .eq("user_id", userId)
    .single();
  if (!programRow) return { error: "Couldn't load your program." };

  const program = programRow.program as GeneratedProgram;
  const day = program.days.find((d) => d.dayNumber === dayNumber);
  if (!day) return { error: "That day isn't in your plan." };

  const index = day.exercises.findIndex((e) => e.slug === currentSlug);
  if (index === -1) return { error: "That exercise isn't in today's plan." };

  // Only accept a replacement this user could legitimately have been offered —
  // never trust a slug straight from the browser.
  const allowed = findAlternatives(
    libraryFor(profile),
    day.exercises[index],
    day.exercises.map((e) => e.slug),
  );
  const replacement = allowed.find((e) => e.slug === replacementSlug);
  if (!replacement) return { error: "That replacement isn't available for this exercise." };

  day.exercises[index] = prescribeExercise(replacement, index, profile);

  const { error } = await supabase
    .from("programs")
    .update({ program })
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export interface IntakeResult {
  waterMl: number;
  proteinG: number;
  error: string | null;
}

export async function logIntake(
  logDate: string,
  waterMlDelta: number,
  proteinGDelta: number,
): Promise<IntakeResult> {
  const { supabase, userId } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("daily_intake")
    .select("water_ml, protein_g")
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (fetchError) return { waterMl: 0, proteinG: 0, error: fetchError.message };

  const waterMl = Math.max(0, (existing?.water_ml ?? 0) + waterMlDelta);
  const proteinG = Math.max(0, (existing?.protein_g ?? 0) + proteinGDelta);

  const { error } = await supabase
    .from("daily_intake")
    .upsert(
      { user_id: userId, log_date: logDate, water_ml: waterMl, protein_g: proteinG, updated_at: new Date().toISOString() },
      { onConflict: "user_id,log_date" },
    );

  if (error) return { waterMl: 0, proteinG: 0, error: error.message };

  revalidatePath("/dashboard");
  return { waterMl, proteinG, error: null };
}

export async function submitReview(rating: number, comment: string): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("reviews").insert({
    user_id: userId,
    rating,
    comment: comment.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { error: null };
}
