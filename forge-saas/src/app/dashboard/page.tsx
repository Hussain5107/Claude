import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedProgram } from "@/lib/exercises/types";
import HomeClient from "@/components/HomeClient";
import { weekDatesFor } from "@/lib/dates";
import { weekdayToDayNumber } from "@/lib/dayRotation";
import { checkProgression } from "@/lib/progression";
import { cycleStatus } from "@/lib/cycle";
import { isEligible, loadCycleContext } from "@/lib/cycleServer";

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

  const today = new Date();
  const weekDates = weekDatesFor(today);
  const todayIso = weekDates[today.getDay()];

  const { data: weekSetRows } = await supabase
    .from("workout_sets")
    .select("log_date")
    .eq("user_id", user.id)
    .gte("log_date", weekDates[0])
    .lte("log_date", weekDates[6]);

  const { data: todayProgress } = await supabase
    .from("progress")
    .select("exercise_slug, done")
    .eq("user_id", user.id)
    .eq("log_date", todayIso);

  const { data: streakRow } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: intakeRow } = await supabase
    .from("daily_intake")
    .select("water_ml, protein_g")
    .eq("user_id", user.id)
    .eq("log_date", todayIso)
    .maybeSingle();

  // Cycle tracking is opt-in and only offered to some accounts, so skip the
  // lookup entirely when it doesn't apply.
  const cycleEligible = isEligible(profile.sex, profile.plan);
  const cycle = cycleEligible ? await loadCycleContext(supabase, user.id, todayIso) : null;
  const cycleState = cycle ? cycleStatus(cycle.settings, today) : null;

  const { data: reviewRow } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Sets logged per weekday this week — the only workload number FORGE
  // actually records, so it's what the weekly chart shows.
  const setsPerDay = Array.from({ length: 7 }, (_, i) =>
    (weekSetRows ?? []).filter((row) => row.log_date === weekDates[i]).length,
  );

  const daysPerWeek = program.daysPerWeek ?? 6;
  const todayDayNumber = weekdayToDayNumber(today.getDay(), profile.day_offset ?? 0, daysPerWeek);
  const todayDay = program.days.find((d) => d.dayNumber === todayDayNumber) ?? null;

  const doneSlugs = new Set((todayProgress ?? []).filter((r) => r.done).map((r) => r.exercise_slug));
  const completedToday = todayDay
    ? todayDay.exercises.filter((e) => doneSlugs.has(e.slug)).length
    : 0;

  return (
    <HomeClient
      email={user.email ?? ""}
      nutrition={program.nutrition}
      today={
        todayDay
          ? {
              name: todayDay.name,
              subtitle: todayDay.subtitle,
              total: todayDay.exercises.length,
              completed: completedToday,
            }
          : null
      }
      setsPerDay={setsPerDay}
      todayIso={todayIso}
      streak={{
        current: streakRow?.current_streak ?? 0,
        longest: streakRow?.longest_streak ?? 0,
        total: streakRow?.total_workouts ?? 0,
      }}
      waterMl={intakeRow?.water_ml ?? 0}
      proteinG={intakeRow?.protein_g ?? 0}
      body={{
        weightKg: profile.weight_kg,
        heightCm: profile.height_cm,
        age: profile.age,
        goal: program.goal,
      }}
      avatarUrl={profile.avatar_url}
      dateOfBirth={profile.date_of_birth}
      accountCreatedAt={profile.created_at}
      alreadyReviewed={!!reviewRow}
      cycle={
        cycleState && cycle
          ? {
              status: cycleState,
              checkIn: cycle.checkIn,
              cycleLength: cycle.settings.averageCycleLength,
            }
          : null
      }
      cycleEligible={cycleEligible}
      cycleEnabled={cycle?.settings.enabled ?? false}
      progression={checkProgression(
        profile.experience,
        profile.created_at,
        streakRow?.total_workouts ?? 0,
      )}
    />
  );
}
