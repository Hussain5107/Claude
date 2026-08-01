import { DAY_TEMPLATES } from "./data";
import { HOME_DUMBBELL_DAY_TEMPLATES } from "./homeDumbbellData";
import { BODYWEIGHT_DAY_TEMPLATES } from "./bodyweightData";
import { buildSplit } from "./splits";
import type {
  DayTemplate,
  ExerciseTemplate,
  GeneratedProgram,
  NutritionTargets,
  PrescribedDay,
  PrescribedExercise,
  UserProfile,
} from "./types";

/** The exercise library the user's equipment gives them access to. */
function libraryFor(profile: UserProfile): DayTemplate[] {
  if (profile.trainingLocation === "home") {
    return profile.hasDumbbellsAtHome ? HOME_DUMBBELL_DAY_TEMPLATES : BODYWEIGHT_DAY_TEMPLATES;
  }
  return DAY_TEMPLATES;
}

/** That library arranged into a split at the user's chosen weekly frequency. */
function templatesFor(profile: UserProfile): DayTemplate[] {
  return buildSplit(libraryFor(profile), profile.daysPerWeek ?? 6);
}

/**
 * Personalization strategy: which exercises you get is driven by your
 * equipment (gym / dumbbells / bodyweight) and how many days a week you
 * train — those pick the library and the split. Your goal and experience
 * then tune volume, rep ranges, rest and nutrition on top of that.
 *
 * Deliberately rules-based rather than AI-generated: for beginner and
 * intermediate lifters, honest personalization really is mostly about
 * equipment, frequency and intensity prescription.
 */

function parseRepRange(reps: string): [number, number] {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [10, 12];
  if (nums.length === 1) return [nums[0], nums[0]];
  return [nums[0], nums[1]];
}

function isMainCompound(index: number): boolean {
  // The first exercise of every day is the day's primary compound lift.
  return index === 0;
}

function prescribeSets(base: number, index: number, profile: UserProfile): number {
  let sets = base;
  const isMain = isMainCompound(index);

  if (profile.experience === "intermediate" && isMain) sets += 1;
  if (profile.experience === "advanced") sets += isMain ? 2 : 1;

  // General fitness doesn't need max hypertrophy volume — trim accessory
  // sets for time efficiency, keep the main compound lift intact.
  if (profile.goal === "general_fitness" && !isMain) sets = Math.max(sets - 1, 2);

  return Math.min(sets, 6);
}

function prescribeReps(baseReps: string, index: number, profile: UserProfile): string {
  const [lo, hi] = parseRepRange(baseReps);
  const isMain = isMainCompound(index);
  const isHold = /hold|s$/i.test(baseReps) && !/\d+–\d+$/.test(baseReps.replace(/s$/, ""));
  if (isHold) return baseReps; // planks etc. — leave as-is

  if (profile.goal === "strength" && isMain) {
    return profile.experience === "beginner" ? "6–8" : "5–6";
  }
  if (profile.goal === "strength" && !isMain) {
    return `${Math.max(lo - 2, 6)}–${Math.max(hi - 2, 8)}`;
  }
  if (profile.goal === "fat_loss") {
    return `${lo}–${hi + 3}`; // slightly higher reps, shorter rest (below)
  }
  return baseReps; // muscle / general_fitness: keep original hypertrophy-tuned ranges
}

function prescribeRest(baseRest: string, index: number, profile: UserProfile): string {
  const isMain = isMainCompound(index);
  const seconds = Number(baseRest.replace(/s$/, "")) || 90;

  if (profile.goal === "strength" && isMain) {
    return `${Math.min(seconds + 60, 180)}s`;
  }
  if (profile.goal === "fat_loss") {
    return `${Math.max(seconds - 30, 45)}s`;
  }
  if (profile.goal === "general_fitness") {
    return `${Math.max(seconds - 15, 45)}s`;
  }
  return baseRest;
}

function prescribeRpe(profile: UserProfile): string {
  if (profile.experience === "advanced") return "RPE 8–9";
  return "RPE 7–8";
}

function prescribeExercise(
  ex: ExerciseTemplate,
  index: number,
  profile: UserProfile,
): PrescribedExercise {
  return {
    ...ex,
    sets: prescribeSets(ex.baseSets, index, profile),
    reps: prescribeReps(ex.baseReps, index, profile),
    rest: prescribeRest(ex.baseRest, index, profile),
    rpe: ex.baseRpe.startsWith("RPE") ? prescribeRpe(profile) : ex.baseRpe,
  };
}

function prescribeDay(
  profile: UserProfile,
  templates: DayTemplate[],
  dayNumber: number,
): PrescribedDay {
  const template = templates.find((d) => d.dayNumber === dayNumber);
  if (!template) {
    return {
      key: "rest",
      dayNumber,
      name: "Rest",
      subtitle: "Recovery Day",
      warmup: [],
      cooldown: [],
      exercises: [],
    };
  }
  return {
    ...template,
    exercises: template.exercises.map((ex, i) => prescribeExercise(ex, i, profile)),
  };
}

function computeNutrition(profile: UserProfile): NutritionTargets {
  const { age, sex, heightCm, weightKg, goal } = profile;

  // Mifflin-St Jeor BMR
  const bmr =
    sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  // Moderately active multiplier — reasonable default for someone starting
  // a 6-day structured program.
  const tdee = bmr * 1.55;

  const calorieAdjust: Record<UserProfile["goal"], number> = {
    muscle: 300,
    strength: 150,
    fat_loss: -500,
    general_fitness: 0,
  };
  const calorieTarget = Math.max(1200, Math.round(tdee + calorieAdjust[goal]));

  const proteinPerKg: Record<UserProfile["goal"], number> = {
    muscle: 2.0,
    strength: 2.0,
    fat_loss: 1.8,
    general_fitness: 1.6,
  };
  const proteinG = Math.round(weightKg * proteinPerKg[goal]);

  const waterL = Math.round((weightKg * 0.035 + 0.6) * 10) / 10;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget,
    proteinG,
    waterL,
  };
}

export function generateProgram(profile: UserProfile): GeneratedProgram {
  const templates = templatesFor(profile);
  const days = templates.map((t) => prescribeDay(profile, templates, t.dayNumber));
  return {
    goal: profile.goal,
    experience: profile.experience,
    daysPerWeek: profile.daysPerWeek ?? 6,
    days,
    nutrition: computeNutrition(profile),
    generatedAt: new Date().toISOString(),
  };
}
