export type MuscleKey =
  | "chest"
  | "frontDelts"
  | "sideDelts"
  | "rearDelts"
  | "triceps"
  | "biceps"
  | "forearms"
  | "lats"
  | "traps"
  | "lowerBack"
  | "abs"
  | "obliques"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves";

export const MUSCLE_LABELS: Record<MuscleKey, string> = {
  chest: "Chest",
  frontDelts: "Front Delts",
  sideDelts: "Side Delts",
  rearDelts: "Rear Delts",
  triceps: "Triceps",
  biceps: "Biceps",
  forearms: "Forearms",
  lats: "Lats",
  traps: "Traps",
  lowerBack: "Lower Back",
  abs: "Abs",
  obliques: "Obliques",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

export interface ExerciseTemplate {
  slug: string;
  name: string;
  equip: string;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  baseSets: number;
  baseReps: string;
  baseRest: string;
  baseRpe: string;
  tempo: string;
  difficulty: "beginner" | "moderate";
  breathing: string;
  cues: string[];
  mistakes: string[];
  alt: string;
  tip: string;
  image: string;
  videoUrl: string | null;
}

export interface DayTemplate {
  key: string;
  dayNumber: number; // 1=Mon ... 6=Sat, matches JS getDay()
  name: string;
  subtitle: string;
  warmup: string[];
  cooldown: string[];
  exercises: ExerciseTemplate[];
}

export type Goal = "muscle" | "strength" | "fat_loss" | "general_fitness";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type Sex = "male" | "female";
export type TrainingLocation = "gym" | "home";
export type DaysPerWeek = 3 | 4 | 5 | 6;

export interface UserProfile {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  experience: ExperienceLevel;
  trainingLocation: TrainingLocation;
  hasDumbbellsAtHome: boolean;
  daysPerWeek: DaysPerWeek;
}

export interface PrescribedExercise extends ExerciseTemplate {
  sets: number;
  reps: string;
  rest: string;
  rpe: string;
}

export interface PrescribedDay {
  key: string;
  dayNumber: number;
  name: string;
  subtitle: string;
  warmup: string[];
  cooldown: string[];
  exercises: PrescribedExercise[];
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  waterL: number;
}

export interface GeneratedProgram {
  goal: Goal;
  experience: ExperienceLevel;
  /** Recorded so the dashboard reads frequency off the plan it's actually
   *  showing, rather than a profile field that may have changed since. */
  daysPerWeek: DaysPerWeek;
  days: PrescribedDay[];
  nutrition: NutritionTargets;
  generatedAt: string;
}
