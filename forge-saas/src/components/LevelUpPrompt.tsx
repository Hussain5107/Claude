"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { levelUp } from "@/app/dashboard/actions";
import { Button, Card } from "./ui";

const DISMISS_KEY = "forge:levelUpDismissed";
const SNOOZE_DAYS = 14;

interface Props {
  eligible: boolean;
  nextLabel: string | null;
  daysTrained: number;
  workoutsDone: number;
}

export default function LevelUpPrompt({ eligible, nextLabel, daysTrained, workoutsDone }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!eligible) return;
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / 86_400_000;
      // Snoozed rather than dismissed forever — someone who isn't ready today
      // usually is a couple of weeks later.
      if (days < SNOOZE_DAYS) return;
    }
    setVisible(true);
  }, [eligible]);

  function snooze() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function confirm() {
    setWorking(true);
    setError(null);
    const result = await levelUp();
    setWorking(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    localStorage.removeItem(DISMISS_KEY);
    setDone(result.newLevel ?? null);
    router.refresh();
  }

  if (done) {
    return (
      <Card className="mb-6 border-[var(--volt)]/40 p-5 text-center">
        <div className="text-3xl">🎉</div>
        <h2 className="mt-1 text-lg font-extrabold">
          You&apos;re {done === "advanced" ? "Advanced" : "Intermediate"} now
        </h2>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          Your plan has been rebuilt with more volume and higher intensity. Ease into the first week.
        </p>
      </Card>
    );
  }

  if (!visible || !nextLabel) return null;

  return (
    <Card className="mb-6 border-[var(--volt)]/40 bg-gradient-to-br from-[rgba(198,255,61,0.10)] to-[rgba(34,211,238,0.10)] p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📈</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">Ready to move up to {nextLabel}?</h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            You&apos;ve been training for {Math.floor(daysTrained / 30)} months and logged{" "}
            {workoutsDone} workouts. Stepping up adds working sets to your main lifts and pushes the
            intensity higher.
          </p>
          <p className="mt-2 text-xs text-[var(--text-faint)]">
            Your logged sets, records and streak are kept — only the sets, reps and intensity change.
          </p>

          {error && <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={confirm} disabled={working} className="px-4 py-2 text-xs">
              {working ? "Rebuilding your plan…" : `Move me up to ${nextLabel}`}
            </Button>
            <Button onClick={snooze} disabled={working} className="px-4 py-2 text-xs">
              Not yet
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
