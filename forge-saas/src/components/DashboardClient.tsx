"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeneratedProgram } from "@/lib/exercises/types";
import { MUSCLE_LABELS } from "@/lib/exercises/types";
import type { LoggedSet } from "@/lib/exercises/loggingTypes";
import ExerciseCard from "./ExerciseCard";
import AppHeader from "./AppHeader";
import {
  toggleExerciseDone,
  saveExerciseNote,
  logSet,
  getAlternatives,
  swapExercise,
} from "@/app/dashboard/actions";
import { PrepList, CardioCard } from "./SessionExtras";
import NutritionToast from "./NutritionToast";
import CycleBanner from "./CycleBanner";
import type { CyclePhase } from "@/lib/cycle";
import type { Adaptation } from "@/lib/cycleAdaptation";
import { weekdayToDayNumber } from "@/lib/dayRotation";
import { cardioPlan } from "@/lib/cardio";

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
  program: GeneratedProgram;
  progressRows: ProgressRow[];
  weekSetRows: WorkoutSetRow[];
  previousBestByExercise: Record<string, LoggedSet>;
  streak: { current: number; longest: number; total: number };
  weekDates: string[]; // 7 ISO dates, index 0 = Sunday
  avatarUrl: string | null;
  name: string;
  dayOffset: number;
  /** Null unless cycle tracking is on, set up, and current. */
  cycle: {
    phase: CyclePhase;
    cycleDay: number;
    adaptation: Adaptation;
    reference: { name: string; weightKg: number } | null;
  } | null;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const FULL_DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DashboardClient({
  program,
  progressRows,
  weekSetRows,
  previousBestByExercise,
  streak,
  weekDates,
  avatarUrl,
  name,
  dayOffset,
  cycle,
}: Props) {
  const router = useRouter();
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

  const isPrepChecked = (slug: string) => progress[`${selectedDate}__${slug}`]?.done ?? false;

  async function handleSwap(currentSlug: string, replacementSlug: string) {
    const result = await swapExercise(selectedDayNumber ?? 0, currentSlug, replacementSlug);
    // The program lives on the server, so pull the updated plan back down
    // rather than trying to patch it locally.
    if (!result.error) router.refresh();
    return result;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      <AppHeader
        title="Workouts"
        subtitle={`${daysPerWeek} days a week`}
        avatarUrl={avatarUrl}
        name={name}
        right={
          <div className="flex items-center gap-2">
            {liveStreak.current > 0 && (
              <span className="rounded-full bg-[rgba(255,176,32,0.12)] px-2.5 py-1 text-xs font-bold text-[var(--amber)]">
                🔥 {liveStreak.current}
              </span>
            )}
            <button
              type="button"
              onClick={toggleVoiceCoach}
              aria-pressed={voiceEnabled}
              title={voiceEnabled ? "Voice coach on" : "Voice coach off"}
              className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                voiceEnabled
                  ? "border-[var(--secondary)] text-[var(--secondary)]"
                  : "border-[var(--border)] text-[var(--text-faint)]"
              }`}
            >
              🎙️
            </button>
          </div>
        }
      />

      {day && selectedIndex === today.getDay() && (
        <NutritionToast
          goal={program.goal}
          isoDate={selectedDate}
          completed={completedCount}
          total={day.exercises.length}
        />
      )}

      {/* Week strip — a dot marks a training day so rest days read at a glance. */}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((label, i) => {
          const d = program.days.find(
            (d) => d.dayNumber === weekdayToDayNumber(i, dayOffset, daysPerWeek),
          );
          const isSelected = i === selectedIndex;
          const isToday = i === today.getDay();
          return (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              aria-label={`${FULL_DAY_LABELS[i]} — ${d ? d.name : "Rest"}`}
              className={`flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition active:scale-95 ${
                isSelected
                  ? "bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white shadow-[0_8px_20px_rgb(var(--primary-rgb)/0.3)]"
                  : "border border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <span
                className={`text-xs font-bold ${
                  isSelected
                    ? "text-white"
                    : isToday
                      ? "text-[var(--secondary)]"
                      : "text-[var(--text-dim)]"
                }`}
              >
                {label}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  d
                    ? isSelected
                      ? "bg-white"
                      : "bg-[var(--primary)]"
                    : isSelected
                      ? "bg-white/35"
                      : "bg-[var(--border-hi)]"
                }`}
              />
            </button>
          );
        })}
      </div>

      {!day ? (
        <div className="glass mt-6 rounded-[18px] border border-[var(--border)] p-10 text-center">
          <div className="mb-3 text-4xl">🌙</div>
          <h2 className="text-xl font-extrabold">Full rest. Let the muscle grow.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-dim)]">
            Optional: a 20–30 minute walk or light mobility work. No lifting today — recovery is
            where the muscle-building actually happens.
          </p>
        </div>
      ) : (
        <>
          {cycle && selectedIndex === today.getDay() && (
            <div className="mt-5">
              <CycleBanner
                phase={cycle.phase}
                cycleDay={cycle.cycleDay}
                adaptation={cycle.adaptation}
                reference={cycle.reference}
              />
            </div>
          )}

          {/* Session header card — the mobile equivalent of a screen title. */}
          <div className="glass mt-5 mb-5 rounded-[18px] border border-[var(--border)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold">{day.name}</h2>
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">
                  {day.subtitle}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-hi)] px-3 py-1 font-mono text-xs font-bold">
                {completedCount}/{day.exercises.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] transition-all"
                style={{ width: `${(completedCount / day.exercises.length) * 100}%` }}
              />
            </div>
          </div>

          <PrepList
            title="🔸 Warm-up"
            hint="Five to ten minutes here makes the first working set feel far better — and it's where most injuries get avoided."
            items={day.warmup}
            slugPrefix="warmup"
            isChecked={isPrepChecked}
            onToggle={handleToggleDone}
          />

          <CardioCard plan={cardioPlan(program.goal, program.experience)} />

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
                  onRequestAlternatives={() => getAlternatives(selectedDayNumber ?? 0, ex.slug)}
                  onSwap={(replacementSlug) => handleSwap(ex.slug, replacementSlug)}
                />
              );
            })}
          </div>

          <div className="mt-6">
            <PrepList
              title="🧊 Cool-down"
              hint="Easy stretching while you're still warm. Won't make you stronger, but it helps you turn up tomorrow feeling less stiff."
              items={day.cooldown}
              slugPrefix="cooldown"
              isChecked={isPrepChecked}
              onToggle={handleToggleDone}
            />
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
          ? "bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white"
          : "glass border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)]"
      }`}
    >
      {children}
    </button>
  );
}
