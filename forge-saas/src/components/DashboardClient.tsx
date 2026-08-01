"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { GeneratedProgram } from "@/lib/exercises/types";
import { MUSCLE_LABELS } from "@/lib/exercises/types";
import type { LoggedSet } from "@/lib/exercises/loggingTypes";
import ExerciseCard from "./ExerciseCard";
import NutritionPanel from "./NutritionPanel";
import { Button } from "./ui";
import { toggleExerciseDone, saveExerciseNote, logSet, logIntake } from "@/app/dashboard/actions";
import { Logo } from "./Logo";
import ReviewPrompt from "./ReviewPrompt";
import InstallAppPrompt from "./InstallAppPrompt";
import { isBirthdayToday } from "@/lib/dates";
import { weekdayToDayNumber } from "@/lib/dayRotation";

interface ProgressRow {
  log_date: string;
  day_number: number;
  exercise_slug: string;
  done: boolean;
  note: string | null;
}

interface WorkoutSetRow {
  log_date: string;
  exercise_slug: string;
  set_number: number;
  weight_kg: number;
  reps: number;
}

interface Props {
  email: string;
  program: GeneratedProgram;
  progressRows: ProgressRow[];
  weekSetRows: WorkoutSetRow[];
  previousBestByExercise: Record<string, LoggedSet>;
  streak: { current: number; longest: number; total: number };
  weekDates: string[]; // 7 ISO dates, index 0 = Sunday
  accountCreatedAt: string;
  alreadyReviewed: boolean;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  dayOffset: number;
  waterMl: number;
  proteinG: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardClient({
  email,
  program,
  progressRows,
  weekSetRows,
  previousBestByExercise,
  streak,
  weekDates,
  accountCreatedAt,
  alreadyReviewed,
  dateOfBirth,
  avatarUrl,
  dayOffset,
  waterMl,
  proteinG,
}: Props) {
  const today = new Date();
  const [selectedIndex, setSelectedIndex] = useState(today.getDay());
  // Read frequency off the stored program rather than the profile: it's the plan
  // actually on screen. Programs generated before days-per-week existed have no
  // such field, and those are all 6-day plans.
  const daysPerWeek = program.daysPerWeek ?? 6;
  const selectedDayNumber = weekdayToDayNumber(selectedIndex, dayOffset, daysPerWeek);
  const [muscleFilter, setMuscleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Local optimistic copy of progress, keyed by `${date}__${slug}`.
  const [progress, setProgress] = useState<Record<string, { done: boolean; note: string }>>(() => {
    const map: Record<string, { done: boolean; note: string }> = {};
    for (const row of progressRows) {
      map[`${row.log_date}__${row.exercise_slug}`] = { done: row.done, note: row.note ?? "" };
    }
    return map;
  });

  // Logged sets this week, keyed by `${date}__${slug}` -> LoggedSet[].
  const [loggedSets, setLoggedSets] = useState<Record<string, LoggedSet[]>>(() => {
    const map: Record<string, LoggedSet[]> = {};
    for (const row of weekSetRows) {
      const key = `${row.log_date}__${row.exercise_slug}`;
      (map[key] ??= []).push({ setNumber: row.set_number, weightKg: row.weight_kg, reps: row.reps });
    }
    return map;
  });
  const [previousBest, setPreviousBest] = useState(previousBestByExercise);
  const [liveStreak, setLiveStreak] = useState(streak);

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  useEffect(() => {
    setVoiceEnabled(localStorage.getItem("forge:voiceCoach") === "on");
  }, []);
  function toggleVoiceCoach() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    localStorage.setItem("forge:voiceCoach", next ? "on" : "off");
  }

  const selectedDate = weekDates[selectedIndex];
  const day = program.days.find((d) => d.dayNumber === selectedDayNumber);

  const musclesToday = useMemo(
    () => (day ? [...new Set(day.exercises.flatMap((e) => e.primary))] : []),
    [day],
  );

  const filteredExercises = useMemo(() => {
    if (!day) return [];
    let list = day.exercises;
    if (muscleFilter !== "all") list = list.filter((e) => e.primary.includes(muscleFilter as never));
    if (search) list = list.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [day, muscleFilter, search]);

  const completedCount = day
    ? day.exercises.filter((e) => progress[`${selectedDate}__${e.slug}`]?.done).length
    : 0;

  function handleToggleDone(slug: string) {
    const key = `${selectedDate}__${slug}`;
    const wasDone = progress[key]?.done ?? false;
    setProgress((p) => ({ ...p, [key]: { done: !wasDone, note: p[key]?.note ?? "" } }));
    void toggleExerciseDone(selectedDate, selectedDayNumber ?? 0, slug, !wasDone);
  }

  function handleSaveNote(slug: string, note: string) {
    const key = `${selectedDate}__${slug}`;
    setProgress((p) => ({ ...p, [key]: { done: p[key]?.done ?? false, note } }));
    void saveExerciseNote(selectedDate, selectedDayNumber ?? 0, slug, note);
  }

  async function handleLogSet(exerciseName: string, slug: string, setNumber: number, weightKg: number, reps: number) {
    const key = `${selectedDate}__${slug}`;
    setLoggedSets((prev) => {
      const existing = prev[key] ?? [];
      return { ...prev, [key]: [...existing, { setNumber, weightKg, reps }] };
    });
    setPreviousBest((prev) => ({ ...prev, [slug]: { setNumber, weightKg, reps } }));

    const result = await logSet(selectedDate, selectedDayNumber ?? 0, slug, exerciseName, setNumber, weightKg, reps, null);
    setLiveStreak((prev) => ({
      current: result.streak.current,
      longest: Math.max(result.streak.longest, prev.longest),
      total: prev.total + (result.streak.current !== prev.current ? 1 : 0),
    }));
    return { isNewPR: result.isNewPR };
  }

  async function handleLogIntake(waterMlDelta: number, proteinGDelta: number) {
    const todayIso = weekDates[today.getDay()];
    const result = await logIntake(todayIso, waterMlDelta, proteinGDelta);
    return { error: result.error };
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[var(--text-faint)] sm:gap-4">
          {liveStreak.current > 0 && (
            <span className="flex items-center gap-1 font-bold text-[var(--amber)]">
              🔥 {liveStreak.current} day{liveStreak.current === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={toggleVoiceCoach}
            className={`rounded-full border px-2.5 py-1 font-bold transition ${
              voiceEnabled
                ? "border-[var(--cyan)] text-[var(--cyan)]"
                : "border-[var(--border)] text-[var(--text-faint)] hover:text-[var(--text)]"
            }`}
            title={voiceEnabled ? "Voice coach on" : "Voice coach off"}
          >
            🎙️ Coach {voiceEnabled ? "on" : "off"}
          </button>
          <Link href="/dashboard/gyms" className="hover:text-[var(--text)]">
            Gyms
          </Link>
          <Link href="/dashboard/progress" className="hover:text-[var(--text)]">
            Progress
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 hover:text-[var(--text)]"
            title="Settings"
          >
            {avatarUrl ? (
              <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-[var(--border-hi)]">
                <Image src={avatarUrl} alt="" fill className="object-cover" />
              </span>
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] text-xs">
                👤
              </span>
            )}
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <span className="hidden sm:inline">{email}</span>
          <form action="/auth/signout" method="post">
            <Button type="submit" className="px-3 py-1.5 text-xs">
              Log out
            </Button>
          </form>
        </div>
      </header>

      <InstallAppPrompt />
      <ReviewPrompt accountCreatedAt={accountCreatedAt} alreadyReviewed={alreadyReviewed} />

      {isBirthdayToday(dateOfBirth) && (
        <div className="mb-6 rounded-2xl border border-[rgba(255,176,32,0.4)] bg-gradient-to-br from-[rgba(255,176,32,0.15)] to-[rgba(139,92,246,0.15)] p-5 text-center">
          <div className="text-3xl">🎂</div>
          <h2 className="mt-1 text-lg font-extrabold">Happy Birthday!</h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Another year stronger. Make today's session count.
          </p>
        </div>
      )}

      <NutritionPanel
        nutrition={program.nutrition}
        waterMl={waterMl}
        proteinG={proteinG}
        onLogIntake={handleLogIntake}
      />

      <div className="mt-6 grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label, i) => {
          const d = program.days.find(
            (d) => d.dayNumber === weekdayToDayNumber(i, dayOffset, daysPerWeek),
          );
          const isSelected = i === selectedIndex;
          return (
            <button
              key={label}
              onClick={() => setSelectedIndex(i)}
              className={`rounded-xl p-3 text-center transition ${
                isSelected
                  ? "bg-gradient-to-br from-[var(--violet)] to-[var(--cyan)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hi)]"
              }`}
            >
              <div
                className={`text-[11px] font-bold uppercase tracking-wide ${
                  isSelected ? "text-white/80" : "text-[var(--text-faint)]"
                }`}
              >
                {label}
              </div>
              <div className={`mt-1 text-xs font-bold ${isSelected ? "text-white" : "text-[var(--text-dim)]"}`}>
                {d ? d.name : "Rest"}
              </div>
            </button>
          );
        })}
      </div>

      {!day ? (
        <div className="glass mt-8 rounded-[18px] border border-[var(--border)] p-14 text-center">
          <div className="mb-3 text-4xl">🌙</div>
          <h2 className="text-xl font-extrabold">Full rest. Let the muscle grow.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-dim)]">
            Optional: a 20–30 minute walk or light mobility work. No lifting today — recovery is
            where the muscle-building actually happens.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-extrabold">{day.name}</h2>
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">
                {day.subtitle}
              </span>
            </div>
            <span className="text-xs font-bold text-[var(--text-dim)]">
              {completedCount} / {day.exercises.length} done
            </span>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {day.warmup.map((w) => (
              <div
                key={w}
                className="glass shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] px-3.5 py-2 text-xs text-[var(--text-dim)]"
              >
                🔸 {w}
              </div>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search today's exercises…"
              className="glass min-w-[180px] flex-1 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--text-faint)]"
            />
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={muscleFilter === "all"} onClick={() => setMuscleFilter("all")}>
                All
              </FilterChip>
              {musclesToday.map((m) => (
                <FilterChip key={m} active={muscleFilter === m} onClick={() => setMuscleFilter(m)}>
                  {MUSCLE_LABELS[m]}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filteredExercises.map((ex) => {
              const key = `${selectedDate}__${ex.slug}`;
              return (
                <ExerciseCard
                  key={ex.slug}
                  index={day.exercises.indexOf(ex)}
                  exercise={ex}
                  done={progress[key]?.done ?? false}
                  note={progress[key]?.note ?? ""}
                  loggedSets={loggedSets[key] ?? []}
                  previousBest={previousBest[ex.slug] ?? null}
                  voiceEnabled={voiceEnabled}
                  onToggleDone={() => handleToggleDone(ex.slug)}
                  onSaveNote={(note) => handleSaveNote(ex.slug, note)}
                  onLogSet={(setNumber, weightKg, reps) => handleLogSet(ex.name, ex.slug, setNumber, weightKg, reps)}
                />
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {day.cooldown.map((c) => (
              <div
                key={c}
                className="glass shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] px-3.5 py-2 text-xs text-[var(--text-dim)]"
              >
                🧊 {c}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
        active
          ? "bg-gradient-to-br from-[var(--violet)] to-[var(--cyan)] text-white"
          : "glass border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)]"
      }`}
    >
      {children}
    </button>
  );
}
