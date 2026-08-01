"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PHASE_LABELS, type CycleStatus } from "@/lib/cycle";
import {
  SYMPTOMS,
  SYMPTOM_LABELS,
  adaptForCycle,
  intensityLabel,
  type CheckIn,
  type EnergyLevel,
  type Symptom,
} from "@/lib/cycleAdaptation";
import { saveCheckIn } from "@/app/dashboard/cycle/actions";

/**
 * The cycle card on Home.
 *
 * Shows where the calendar says you are, what that might mean for today, and a
 * check-in that overrides it. The suggestion never removes a session and never
 * says you shouldn't train — it only changes how heavy the day is *suggested*
 * to be, and one tap restores your usual weights.
 */
interface Props {
  status: CycleStatus;
  checkIn: CheckIn | null;
  todayIso: string;
  cycleLength: number;
}

const ENERGY_OPTIONS: { value: EnergyLevel; emoji: string; label: string }[] = [
  { value: "low", emoji: "😴", label: "Low" },
  { value: "medium", emoji: "🙂", label: "Medium" },
  { value: "high", emoji: "🔥", label: "High" },
];

export default function CycleCard({ status, checkIn, todayIso, cycleLength }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [energy, setEnergy] = useState<EnergyLevel | null>(checkIn?.energy ?? null);
  const [symptoms, setSymptoms] = useState<Symptom[]>(checkIn?.symptoms ?? []);
  const [override, setOverride] = useState<"follow" | "push" | null>(checkIn?.override ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adaptation = adaptForCycle(status.phase, { energy, symptoms, override });

  async function persist(next: {
    energy?: EnergyLevel | null;
    symptoms?: Symptom[];
    override?: "follow" | "push" | null;
  }) {
    const payload = {
      energy: next.energy !== undefined ? next.energy : energy,
      symptoms: next.symptoms !== undefined ? next.symptoms : symptoms,
      override: next.override !== undefined ? next.override : override,
    };
    setSaving(true);
    setError(null);
    const result = await saveCheckIn(todayIso, payload.energy, payload.symptoms, payload.override);
    setSaving(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  function pickEnergy(value: EnergyLevel) {
    const next = energy === value ? null : value;
    setEnergy(next);
    void persist({ energy: next });
  }

  function toggleSymptom(symptom: Symptom) {
    const next = symptoms.includes(symptom)
      ? symptoms.filter((s) => s !== symptom)
      : [...symptoms, symptom];
    setSymptoms(next);
    void persist({ symptoms: next });
  }

  function setChoice(choice: "follow" | "push") {
    const next = override === choice ? null : choice;
    setOverride(next);
    void persist({ override: next });
  }

  return (
    <section className="glass mt-4 rounded-[22px] border border-[var(--border)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">Your cycle</h2>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
            Day {status.cycleDay} · {PHASE_LABELS[status.phase]}
          </p>
        </div>
        <PhaseDial day={status.cycleDay} length={cycleLength} />
      </div>

      {status.stale ? (
        <p className="mt-3 rounded-xl border border-[rgba(255,176,32,0.35)] bg-[rgba(255,176,32,0.08)] px-3 py-2.5 text-xs text-[var(--amber)]">
          It&apos;s been a few cycles since you last updated your start date, so this count has
          probably drifted. Update it in Profile → Cycle tracking and it&apos;ll be accurate again.
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{TONE_EMOJI[adaptation.tone]}</span>
              <span className="text-sm font-bold">{adaptation.headline}</span>
            </div>
            <p className="mt-1.5 text-sm text-[var(--text-dim)]">{adaptation.reason}</p>
            <p className="mt-2 font-mono text-xs font-bold text-[var(--secondary)]">
              {intensityLabel(adaptation.intensity)}
            </p>
            {adaptation.ideas.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {adaptation.ideas.map((idea) => (
                  <li
                    key={idea}
                    className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-dim)]"
                  >
                    {idea}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <ChoiceButton active={override === "follow"} onClick={() => setChoice("follow")}>
              Follow the suggestion
            </ChoiceButton>
            <ChoiceButton active={override === "push"} onClick={() => setChoice("push")}>
              Train as normal
            </ChoiceButton>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 w-full rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] py-2 text-xs font-bold transition active:scale-[0.98]"
      >
        {open ? "Hide check-in" : checkIn ? "Update today's check-in" : "How do you feel today?"}
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Energy
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ENERGY_OPTIONS.map((o) => (
              <ChoiceButton key={o.value} active={energy === o.value} onClick={() => pickEnergy(o.value)}>
                {o.emoji} {o.label}
              </ChoiceButton>
            ))}
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Anything bothering you?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                aria-pressed={symptoms.includes(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                  symptoms.includes(s)
                    ? "bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white"
                    : "border border-[var(--border)] text-[var(--text-dim)]"
                }`}
              >
                {SYMPTOM_LABELS[s]}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            Only you can see any of this. Nothing here is medical advice — if something feels wrong
            rather than just hard, that&apos;s a conversation for a doctor, not an app.
          </p>
        </div>
      )}

      {saving && <p className="mt-2 text-[11px] text-[var(--text-faint)]">Saving…</p>}
      {error && <p className="mt-2 text-xs text-[var(--rose)]">Couldn&apos;t save that: {error}</p>}
    </section>
  );
}

const TONE_EMOJI: Record<"recover" | "steady" | "push", string> = {
  recover: "🧘",
  steady: "🙂",
  push: "🔥",
};

function ChoiceButton({
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-2 text-xs font-bold transition active:scale-95 ${
        active
          ? "bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)]"
      }`}
    >
      {children}
    </button>
  );
}

/** A ring showing how far through the cycle today is. */
function PhaseDial({ day, length }: { day: number; length: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, day / length);

  return (
    <div className="relative h-[58px] w-[58px] shrink-0">
      <svg viewBox="0 0 58 58" className="h-full w-full -rotate-90">
        <circle cx="29" cy="29" r={radius} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="29"
          cy="29"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold">
        {day}
      </span>
    </div>
  );
}
