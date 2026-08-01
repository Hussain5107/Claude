"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { estimated1RM, updateStreak, type StreakState } from "@/lib/tracking";
import { generateProgram, libraryFor, prescribeExercise } from "@/lib/exercises/generator";
import { checkProgression } from "@/lib/progression";
import { parseSwapBlock, normaliseName } from "@/lib/aiSuggestions";
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

/** Steps the user up a level and rebuilds their plan with the extra volume and
 *  intensity that level gets. Re-checks eligibility server-side. */
export async function levelUp(): Promise<{ error: string | null; newLevel?: string }> {
  const { supabase, userId } = await requireUser();

  const profile = await loadUserProfile(supabase, userId);
  if (!profile) return { error: "Couldn't load your profile." };

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single();
  const { data: streakRow } = await supabase
    .from("streaks")
    .select("total_workouts")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileRow) return { error: "Couldn't load your profile." };

  // Checked again here rather than trusting the button — the client could be
  // stale, or the request could be replayed.
  const status = checkProgression(
    profile.experience,
    profileRow.created_at,
    streakRow?.total_workouts ?? 0,
  );
  if (!status.eligible || !status.next) {
    return { error: "You're not eligible to move up a level yet." };
  }

  const upgraded: UserProfile = { ...profile, experience: status.next };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ experience: status.next })
    .eq("id", userId);
  if (updateError) return { error: updateError.message };

  const { error: programError } = await supabase
    .from("programs")
    .upsert({ user_id: userId, program: generateProgram(upgraded), created_at: new Date().toISOString() });
  if (programError) return { error: programError.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { error: null, newLevel: status.next };
}

/**
 * Packages the user's training history as Markdown they can paste into any AI
 * assistant. FORGE has no AI of its own, so this is the bridge: the file leads
 * with instructions telling the assistant what it's looking at and what to
 * produce, including an optional structured block the app can read back.
 */
export async function exportTrainingData(): Promise<{ markdown: string; error: string | null }> {
  const { supabase, userId } = await requireUser();

  const profile = await loadUserProfile(supabase, userId);
  if (!profile) return { markdown: "", error: "Couldn't load your profile." };

  const since = new Date();
  since.setDate(since.getDate() - 120);
  const sinceIso = since.toISOString().slice(0, 10);

  const [{ data: programRow }, { data: sets }, { data: prs }, { data: streakRow }] =
    await Promise.all([
      supabase.from("programs").select("program").eq("user_id", userId).single(),
      supabase
        .from("workout_sets")
        .select("log_date, exercise_name, set_number, weight_kg, reps")
        .eq("user_id", userId)
        .gte("log_date", sinceIso)
        .order("log_date", { ascending: true }),
      supabase
        .from("personal_records")
        .select("exercise_name, weight_kg, reps, estimated_1rm, achieved_at")
        .eq("user_id", userId)
        .order("estimated_1rm", { ascending: false }),
      supabase
        .from("streaks")
        .select("current_streak, longest_streak, total_workouts")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const program = programRow?.program as GeneratedProgram | undefined;
  const allSets = sets ?? [];

  const lines: string[] = [];

  lines.push("# FORGE training export");
  lines.push("");
  lines.push(
    "You are being asked to review someone's strength training history and suggest improvements.",
  );
  lines.push("");
  lines.push("**What to do:**");
  lines.push("");
  lines.push("1. Look at whether their lifts are actually progressing, and say so plainly.");
  lines.push("2. Point out anything that looks stalled, neglected, or imbalanced.");
  lines.push("3. Suggest specific changes, and explain why in one line each.");
  lines.push(
    "4. Only suggest exercises that fit the equipment listed below — they can't use a machine they don't have.",
  );
  lines.push("");
  lines.push(
    "**If you recommend swapping any exercises, end your reply with a block in exactly this format so the app can read it:**",
  );
  lines.push("");
  lines.push("```forge-swaps");
  lines.push("Push A | Barbell Bench Press -> Incline Dumbbell Press");
  lines.push("Legs A | Leg Press -> Bulgarian Split Squat");
  lines.push("```");
  lines.push("");
  lines.push(
    "Use the exact day and exercise names shown below. Anything the app doesn't recognise is ignored, and nothing is applied without the user approving it.",
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## Lifter profile");
  lines.push("");
  lines.push(`- Age: ${profile.age}`);
  lines.push(`- Sex: ${profile.sex}`);
  lines.push(`- Height: ${profile.heightCm} cm`);
  lines.push(`- Weight: ${profile.weightKg} kg`);
  lines.push(`- Goal: ${profile.goal.replace("_", " ")}`);
  lines.push(`- Experience level: ${profile.experience}`);
  lines.push(
    `- Trains: ${profile.trainingLocation === "home" ? (profile.hasDumbbellsAtHome ? "at home, with dumbbells" : "at home, bodyweight only (no dumbbells)") : "in a gym, full equipment"}`,
  );
  lines.push(`- Days per week: ${profile.daysPerWeek}`);
  if (streakRow) {
    lines.push(
      `- Consistency: ${streakRow.total_workouts} sessions logged, current streak ${streakRow.current_streak}, longest ${streakRow.longest_streak}`,
    );
  }
  lines.push("");

  if (program) {
    lines.push("## Current program");
    lines.push("");
    for (const day of program.days) {
      lines.push(`### ${day.name} — ${day.subtitle}`);
      lines.push("");
      for (const ex of day.exercises) {
        lines.push(`- ${ex.name} — ${ex.sets}×${ex.reps}, rest ${ex.rest} (${ex.equip})`);
      }
      lines.push("");
    }
  }

  lines.push("## Logged sets (last 120 days)");
  lines.push("");
  if (allSets.length === 0) {
    lines.push("_No sets logged yet._");
    lines.push("");
  } else {
    // Grouped by exercise so trends are readable, rather than a flat dump.
    const byExercise = new Map<string, typeof allSets>();
    for (const set of allSets) {
      const list = byExercise.get(set.exercise_name) ?? [];
      list.push(set);
      byExercise.set(set.exercise_name, list);
    }
    for (const [name, rows] of [...byExercise.entries()].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`### ${name}`);
      lines.push("");
      const byDate = new Map<string, string[]>();
      for (const r of rows) {
        const list = byDate.get(r.log_date) ?? [];
        list.push(`${r.weight_kg}kg×${r.reps}`);
        byDate.set(r.log_date, list);
      }
      for (const [date, entries] of byDate) {
        lines.push(`- ${date}: ${entries.join(", ")}`);
      }
      lines.push("");
    }
  }

  if (prs && prs.length > 0) {
    lines.push("## Personal records");
    lines.push("");
    for (const pr of prs.slice(0, 30)) {
      lines.push(
        `- ${pr.exercise_name}: ${pr.weight_kg}kg × ${pr.reps} (est. 1RM ${Math.round(pr.estimated_1rm)}kg) on ${String(pr.achieved_at).slice(0, 10)}`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    `_Exported from FORGE on ${new Date().toISOString().slice(0, 10)}. This is training data, not medical information — advice given on it is general fitness guidance, not medical advice._`,
  );

  return { markdown: lines.join("\n"), error: null };
}

export interface ReviewedSuggestion {
  dayNumber: number;
  dayName: string;
  fromSlug: string;
  fromName: string;
  toSlug: string;
  toName: string;
  toEquip: string;
}

export interface SuggestionReview {
  usable: ReviewedSuggestion[];
  /** Suggestions that were understood but can't be applied, with the reason —
   *  shown so the user isn't left wondering why advice vanished. */
  rejected: { text: string; reason: string }[];
  error: string | null;
}

/**
 * Checks swaps suggested by an AI assistant against the user's actual plan and
 * equipment. Nothing is applied here — this only reports what could be applied,
 * and the user approves each one individually.
 */
export async function reviewAiSuggestions(pastedText: string): Promise<SuggestionReview> {
  const { supabase, userId } = await requireUser();

  const profile = await loadUserProfile(supabase, userId);
  if (!profile) return { usable: [], rejected: [], error: "Couldn't load your profile." };

  const { data: programRow } = await supabase
    .from("programs")
    .select("program")
    .eq("user_id", userId)
    .single();
  if (!programRow) return { usable: [], rejected: [], error: "Couldn't load your program." };

  const program = programRow.program as GeneratedProgram;
  const library = libraryFor(profile);

  const usable: ReviewedSuggestion[] = [];
  const rejected: { text: string; reason: string }[] = [];

  for (const swap of parseSwapBlock(pastedText)) {
    const label = `${swap.dayName}: ${swap.fromName} → ${swap.toName}`;

    const day = program.days.find(
      (d) => normaliseName(d.name) === normaliseName(swap.dayName),
    );
    if (!day) {
      rejected.push({ text: label, reason: `You have no day called "${swap.dayName}".` });
      continue;
    }

    const from = day.exercises.find(
      (e) => normaliseName(e.name) === normaliseName(swap.fromName),
    );
    if (!from) {
      rejected.push({ text: label, reason: `"${swap.fromName}" isn't in that day.` });
      continue;
    }

    // Must be a replacement this user could legitimately be offered — same
    // check the manual swap uses, so AI advice can't introduce equipment they
    // don't have.
    const allowed = findAlternatives(library, from, day.exercises.map((e) => e.slug));
    const to = allowed.find((e) => normaliseName(e.name) === normaliseName(swap.toName));
    if (!to) {
      rejected.push({
        text: label,
        reason: `"${swap.toName}" isn't available for your equipment, or is already in that day.`,
      });
      continue;
    }

    usable.push({
      dayNumber: day.dayNumber,
      dayName: day.name,
      fromSlug: from.slug,
      fromName: from.name,
      toSlug: to.slug,
      toName: to.name,
      toEquip: to.equip,
    });
  }

  return { usable, rejected, error: null };
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
