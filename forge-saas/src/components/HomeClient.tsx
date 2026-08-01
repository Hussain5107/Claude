"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Goal, NutritionTargets } from "@/lib/exercises/types";
import { logIntake } from "@/app/dashboard/actions";
import { isBirthdayToday } from "@/lib/dates";
import type { ProgressionStatus } from "@/lib/progression";
import type { CycleStatus } from "@/lib/cycle";
import type { CheckIn } from "@/lib/cycleAdaptation";
import CycleCard from "./CycleCard";
import InstallAppPrompt from "./InstallAppPrompt";
import ReviewPrompt from "./ReviewPrompt";
import LevelUpPrompt from "./LevelUpPrompt";
import Ring from "./Ring";

/**
 * The home tab.
 *
 * Everything here is a number FORGE actually stores — sets you logged, water
 * and protein you tapped in, the profile you filled at onboarding. Nothing is
 * estimated on your behalf, so there are no step counts, calories burned or
 * body-fat readings: the app has no way to know them.
 */

interface TodaySession {
  name: string;
  subtitle: string;
  total: number;
  completed: number;
}

interface Props {
  email: string;
  nutrition: NutritionTargets;
  today: TodaySession | null;
  setsPerDay: number[]; // 7 entries, index 0 = Sunday
  todayIso: string;
  streak: { current: number; longest: number; total: number };
  waterMl: number;
  proteinG: number;
  body: { weightKg: number | null; heightCm: number | null; age: number | null; goal: Goal };
  avatarUrl: string | null;
  dateOfBirth: string | null;
  accountCreatedAt: string;
  alreadyReviewed: boolean;
  progression: ProgressionStatus;
  /** Null unless the user has cycle tracking on with a start date entered. */
  cycle: { status: CycleStatus; checkIn: CheckIn | null; cycleLength: number } | null;
  /** Whether the feature is offered to this account at all. */
  cycleEligible: boolean;
  cycleEnabled: boolean;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const GOAL_LABELS: Record<Goal, string> = {
  muscle: "Build muscle",
  strength: "Get stronger",
  fat_loss: "Lose fat",
  general_fitness: "General fitness",
};

export default function HomeClient({
  email,
  nutrition,
  today,
  setsPerDay,
  todayIso,
  streak,
  waterMl,
  proteinG,
  body,
  avatarUrl,
  dateOfBirth,
  accountCreatedAt,
  alreadyReviewed,
  progression,
  cycle,
  cycleEligible,
  cycleEnabled,
}: Props) {
  const [water, setWater] = useState(waterMl);
  const [protein, setProtein] = useState(proteinG);
  const [proteinInput, setProteinInput] = useState("");
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Rendered on the server too, so the greeting has to settle after mount —
  // otherwise the server's clock decides what time of day it is for you.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const name = displayName(email);
  const targetWaterMl = Math.round(nutrition.waterL * 1000);
  const todayIndex = new Date(todayIso + "T12:00:00").getDay();
  const maxSets = Math.max(1, ...setsPerDay);

  async function addWater(ml: number) {
    setPending(true);
    setIntakeError(null);
    const previous = water;
    setWater((w) => Math.max(0, w + ml));
    const result = await logIntake(todayIso, ml, 0);
    setPending(false);
    if (result.error) {
      setWater(previous);
      setIntakeError(result.error);
    }
  }

  async function addProtein() {
    const grams = parseInt(proteinInput, 10);
    if (!grams || grams <= 0) return;
    setPending(true);
    setIntakeError(null);
    const previous = protein;
    setProtein((p) => p + grams);
    const result = await logIntake(todayIso, 0, grams);
    setPending(false);
    if (result.error) {
      setProtein(previous);
      setIntakeError(result.error);
    } else {
      setProteinInput("");
    }
  }

  const bmi =
    body.weightKg && body.heightCm
      ? (body.weightKg / (body.heightCm / 100) ** 2).toFixed(1)
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      {/* Greeting bar — the one screen that leads with who you are. */}
      <header
        className="mb-5 flex items-center justify-between gap-3"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-faint)]">
            {greeting}
          </p>
          <h1 className="truncate text-2xl font-extrabold">{name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {streak.current > 0 && (
            <span className="rounded-full bg-[rgba(255,176,32,0.12)] px-3 py-1.5 text-sm font-bold text-[var(--amber)]">
              🔥 {streak.current}
            </span>
          )}
          <Link
            href="/dashboard/settings"
            aria-label="Profile"
            className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)]"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg">👤</span>
            )}
          </Link>
        </div>
      </header>

      <InstallAppPrompt />
      <LevelUpPrompt
        eligible={progression.eligible}
        nextLabel={progression.nextLabel}
        daysTrained={progression.daysTrained}
        workoutsDone={progression.workoutsDone}
      />
      <ReviewPrompt accountCreatedAt={accountCreatedAt} alreadyReviewed={alreadyReviewed} />

      {isBirthdayToday(dateOfBirth) && (
        <div className="mb-4 rounded-[22px] border border-[rgba(255,176,32,0.4)] bg-gradient-to-br from-[rgba(255,176,32,0.15)] to-[rgb(var(--primary-rgb)/0.15)] p-5 text-center">
          <div className="text-3xl">🎂</div>
          <h2 className="mt-1 text-lg font-extrabold">Happy Birthday!</h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Another year stronger. Make today&apos;s session count.
          </p>
        </div>
      )}

      {/* Today's plan — the hero card, and the main way into a session. */}
      {today ? (
        <Link
          href="/dashboard/workouts"
          className="block rounded-[22px] bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] p-[1.5px] shadow-[0_16px_40px_rgb(var(--primary-rgb)/0.28)] transition active:scale-[0.99]"
        >
          <div className="rounded-[21px] bg-[color-mix(in_srgb,var(--bg-2)_92%,transparent)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--secondary)]">
                  Today&apos;s plan
                </p>
                <h2 className="mt-1 truncate text-2xl font-extrabold">{today.name}</h2>
                <p className="truncate text-sm text-[var(--text-dim)]">{today.subtitle}</p>
              </div>
              <span className="mt-1 shrink-0 text-2xl">🏋️</span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.09)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] transition-all"
                style={{ width: `${(today.completed / today.total) * 100}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[var(--text-dim)]">
                {today.completed} of {today.total} exercises
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] px-4 py-2 text-xs font-bold text-white">
                {today.completed === 0
                  ? "Start workout"
                  : today.completed >= today.total
                    ? "Done ✓"
                    : "Continue"}
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </Link>
      ) : (
        <div className="glass rounded-[22px] border border-[var(--border)] p-6 text-center">
          <div className="text-3xl">🌙</div>
          <h2 className="mt-1 text-lg font-extrabold">Rest day</h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Nothing scheduled. A walk or light stretching is plenty — this is when the muscle
            actually rebuilds.
          </p>
          <Link
            href="/dashboard/workouts"
            className="mt-3 inline-block text-xs font-bold text-[var(--secondary)]"
          >
            See the week →
          </Link>
        </div>
      )}

      {cycle && (
        <CycleCard
          status={cycle.status}
          checkIn={cycle.checkIn}
          todayIso={todayIso}
          cycleLength={cycle.cycleLength}
        />
      )}

      {cycleEligible && !cycleEnabled && (
        <Link
          href="/dashboard/settings"
          className="glass mt-4 block rounded-[22px] border border-[var(--border)] p-4 transition active:scale-[0.99]"
        >
          <div className="text-sm font-bold">🌸 Cycle-adaptive training</div>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            Optional: get load suggestions that follow your cycle, and log how you feel each day.
            Private to you, and it never removes a session. Turn it on in Profile →
          </p>
        </Link>
      )}

      {/* Rings: session progress plus the two things you log by hand. */}
      <section className="glass mt-4 rounded-[22px] border border-[var(--border)] p-5">
        <div className="grid grid-cols-3 gap-2">
          <Ring
            value={today ? today.completed : 0}
            max={today ? today.total : 1}
            color="var(--primary)"
            label="Session"
            display={today ? `${today.completed}/${today.total}` : "Rest"}
          />
          <Ring
            value={water}
            max={targetWaterMl}
            color="var(--secondary)"
            label="Water"
            display={`${(water / 1000).toFixed(1)}L`}
          />
          <Ring
            value={protein}
            max={nutrition.proteinG}
            color="var(--volt)"
            label="Protein"
            display={`${protein}g`}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {[250, 500, 1000].map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => void addWater(ml)}
              disabled={pending}
              className="flex-1 rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] py-2 text-xs font-bold transition active:scale-95 disabled:opacity-40"
            >
              💧 +{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Protein (g)"
            value={proteinInput}
            onChange={(e) => setProteinInput(e.target.value)}
            className="w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-2)] px-4 py-2 text-xs outline-none focus:border-[var(--secondary)]"
          />
          <button
            type="button"
            onClick={() => void addProtein()}
            disabled={pending || !proteinInput}
            className="rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] px-5 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-40"
          >
            Add
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Calories / day" value={nutrition.calorieTarget.toLocaleString()} accent="var(--volt)" />
          <Tile label="Maintenance" value={nutrition.tdee.toLocaleString()} accent="var(--text)" />
        </div>

        {intakeError && (
          <p className="mt-2 text-xs text-[var(--rose)]">Couldn&apos;t log that: {intakeError}</p>
        )}
      </section>

      {/* This week — sets logged per day, the only workload FORGE records. */}
      <section className="glass mt-4 rounded-[22px] border border-[var(--border)] p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold">This week</h2>
          <span className="font-mono text-xs text-[var(--text-faint)]">
            {setsPerDay.reduce((a, b) => a + b, 0)} sets
          </span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {setsPerDay.map((count, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-md transition-all ${
                    count === 0
                      ? "bg-[var(--border)]"
                      : i === todayIndex
                        ? "bg-gradient-to-t from-[var(--primary)] to-[var(--secondary)]"
                        : "bg-[rgb(var(--primary-rgb)/0.55)]"
                  }`}
                  style={{ height: count === 0 ? "3px" : `${(count / maxSets) * 100}%` }}
                  title={`${count} set${count === 1 ? "" : "s"}`}
                />
              </div>
              <span
                className={`text-[10px] font-bold ${
                  i === todayIndex ? "text-[var(--secondary)]" : "text-[var(--text-faint)]"
                }`}
              >
                {DAY_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Streak + profile numbers. */}
      <section className="mt-4 grid grid-cols-3 gap-2">
        <Tile label="Streak" value={`${streak.current}d`} accent="var(--amber)" />
        <Tile label="Best" value={`${streak.longest}d`} accent="var(--secondary)" />
        <Tile label="Workouts" value={`${streak.total}`} accent="var(--primary)" />
      </section>

      <section className="mt-2 grid grid-cols-3 gap-2">
        <Tile label="Weight" value={body.weightKg ? `${body.weightKg}kg` : "—"} accent="var(--text)" />
        <Tile label="Height" value={body.heightCm ? `${body.heightCm}cm` : "—"} accent="var(--text)" />
        <Tile label="BMI" value={bmi ?? "—"} accent="var(--text)" />
      </section>
      <p className="mt-2 px-1 text-[11px] text-[var(--text-faint)]">
        Goal: {GOAL_LABELS[body.goal]}
        {body.age ? ` · ${body.age} years old` : ""} · update these in Profile.
      </p>

      {/* Quick actions. */}
      <section className="mt-5 grid grid-cols-2 gap-2">
        <ActionCard href="/dashboard/progress" emoji="📈" title="Progress" hint="Charts, PRs, photos" />
        <ActionCard href="/dashboard/gyms" emoji="📍" title="Gyms nearby" hint="Find somewhere to lift" />
        <ActionCard href="/dashboard/workouts" emoji="🔁" title="Swap exercises" hint="Change today's moves" />
        <ActionCard href="/dashboard/settings" emoji="⚙️" title="Settings" hint="Plan, reminders, profile" />
      </section>
    </main>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-3 text-center">
      <div className="font-mono text-lg font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  emoji,
  title,
  hint,
}: {
  href: string;
  emoji: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="glass rounded-2xl border border-[var(--border)] p-4 transition active:scale-[0.98]"
    >
      <div className="text-xl">{emoji}</div>
      <div className="mt-1.5 text-sm font-bold">{title}</div>
      <div className="text-[11px] text-[var(--text-faint)]">{hint}</div>
    </Link>
  );
}

/** "hussain.raza@gmail.com" -> "Hussain" — there's no name field to use. */
function displayName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._\-+0-9]/).filter(Boolean)[0] ?? local;
  if (!first) return "Athlete";
  return first.charAt(0).toUpperCase() + first.slice(1);
}
