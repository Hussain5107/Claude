import { PHASE_LABELS, type CyclePhase } from "@/lib/cycle";
import { intensityLabel, suggestedWeight, type Adaptation } from "@/lib/cycleAdaptation";

/**
 * The one-line version of the cycle suggestion, shown above today's session.
 *
 * It sits next to the exercises rather than replacing them: the plan is
 * unchanged, this just says what load to aim for. When the user has chosen to
 * train as normal it says so and gets out of the way.
 */
interface Props {
  phase: CyclePhase;
  cycleDay: number;
  adaptation: Adaptation;
  /** Their heaviest recent set, if there is one, to make the advice concrete. */
  reference: { name: string; weightKg: number } | null;
}

export default function CycleBanner({ phase, cycleDay, adaptation, reference }: Props) {
  const example =
    reference && reference.weightKg > 0 && adaptation.intensity < 1
      ? `${reference.name}: ${suggestedWeight(reference.weightKg, adaptation.intensity)}kg instead of ${reference.weightKg}kg`
      : null;

  return (
    <div className="mb-4 rounded-[18px] border border-[var(--border)] bg-[var(--bg-2)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Cycle day {cycleDay} · {PHASE_LABELS[phase]}
          </p>
          <p className="mt-0.5 text-sm font-bold">{adaptation.headline}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--surface-hi)] px-3 py-1 font-mono text-[11px] font-bold text-[var(--secondary)]">
          {intensityLabel(adaptation.intensity)}
        </span>
      </div>
      {example && (
        <p className="mt-2 font-mono text-xs text-[var(--text-dim)]">e.g. {example}</p>
      )}
      <p className="mt-2 text-xs text-[var(--text-faint)]">
        {adaptation.overridden
          ? "You're training as normal today — the plan below is untouched."
          : "A suggestion, not a rule. The session below is the same either way."}
      </p>
    </div>
  );
}
