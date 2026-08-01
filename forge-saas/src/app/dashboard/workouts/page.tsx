import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedProgram } from "@/lib/exercises/types";
import DashboardClient from "@/components/DashboardClient";
import { weekDatesFor } from "@/lib/dates";
import { resolveDisplayName } from "@/lib/displayName";
import { cycleStatus } from "@/lib/cycle";
import { adaptForCycle } from "@/lib/cycleAdaptation";
import { isEligible, loadCycleContext } from "@/lib/cycleServer";

export default async function WorkoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.onboarded) redirect("/onboarding");

  const { data: programRow } = await supabase
    .from("programs")
    .select("program")
    .eq("user_id", user.id)
    .single();

  if (!programRow) redirect("/onboarding");

  const program = programRow.program as GeneratedProgram;

  // Progress for the current week (Sun..Sat), used for done-state + notes.
  const weekDates = weekDatesFor(new Date());

  const { data: progressRows } = await supabase
    .from("progress")
    .select("*")
    .eq("user_id", user.id)
    .gte("log_date", weekDates[0])
    .lte("log_date", weekDates[6]);

  // Sets logged this week (for the "logged sets" checkmarks on each card).
  const { data: weekSetRows } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("user_id", user.id)
    .gte("log_date", weekDates[0])
    .lte("log_date", weekDates[6]);

  // Most recent set ever logged per exercise (for the "last time" hint) —
  // fetch a reasonable recent window and reduce to one-per-exercise here.
  const { data: recentSetRows } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("user_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(300);

  const previousBestByExercise: Record<string, { setNumber: number; weightKg: number; reps: number }> = {};
  for (const row of recentSetRows ?? []) {
    if (!previousBestByExercise[row.exercise_slug]) {
      previousBestByExercise[row.exercise_slug] = {
        setNumber: row.set_number,
        weightKg: row.weight_kg,
        reps: row.reps,
      };
    }
  }

  // The suggestion is phrased against a real number the user has lifted, so
  // pick their heaviest recent set as the example.
  const heaviest = (recentSetRows ?? []).reduce<{ name: string; weightKg: number } | null>(
    (best, row) =>
      row.weight_kg > (best?.weightKg ?? 0)
        ? { name: row.exercise_name, weightKg: row.weight_kg }
        : best,
    null,
  );

  const cycle = isEligible(profile.sex, profile.plan)
    ? await loadCycleContext(supabase, user.id, weekDates[new Date().getDay()])
    : null;
  const cycleState = cycle ? cycleStatus(cycle.settings) : null;

  const { data: streakRow } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <DashboardClient
      program={program}
      progressRows={progressRows ?? []}
      weekSetRows={weekSetRows ?? []}
      previousBestByExercise={previousBestByExercise}
      streak={{
        current: streakRow?.current_streak ?? 0,
        longest: streakRow?.longest_streak ?? 0,
        total: streakRow?.total_workouts ?? 0,
      }}
      weekDates={weekDates}
      avatarUrl={profile.avatar_url}
      name={resolveDisplayName(profile.display_name, user.email)}
      dayOffset={profile.day_offset ?? 0}
      cycle={
        cycleState && !cycleState.stale
          ? {
              phase: cycleState.phase,
              cycleDay: cycleState.cycleDay,
              adaptation: adaptForCycle(cycleState.phase, cycle!.checkIn),
              reference: heaviest,
            }
          : null
      }
    />
  );
}
