import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedProgram } from "@/lib/exercises/types";
import DashboardClient from "@/components/DashboardClient";
import { checkProgression } from "@/lib/progression";

export default async function DashboardPage() {
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
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

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

  const { data: streakRow } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: reviewRow } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const todayIso = weekDates[today.getDay()];
  const { data: intakeRow } = await supabase
    .from("daily_intake")
    .select("water_ml, protein_g")
    .eq("user_id", user.id)
    .eq("log_date", todayIso)
    .maybeSingle();

  const progression = checkProgression(
    profile.experience,
    profile.created_at,
    streakRow?.total_workouts ?? 0,
  );

  return (
    <DashboardClient
      email={user.email ?? ""}
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
      accountCreatedAt={profile.created_at}
      alreadyReviewed={!!reviewRow}
      dateOfBirth={profile.date_of_birth}
      avatarUrl={profile.avatar_url}
      dayOffset={profile.day_offset ?? 0}
      waterMl={intakeRow?.water_ml ?? 0}
      proteinG={intakeRow?.protein_g ?? 0}
      progression={progression}
    />
  );
}
