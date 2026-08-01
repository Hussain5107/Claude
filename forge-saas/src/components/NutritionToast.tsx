"use client";

import { useEffect, useState } from "react";
import type { Goal } from "@/lib/exercises/types";
import { tipForDay } from "@/lib/nutritionTips";

/**
 * A one-line food reminder that appears once you're partway through a session.
 *
 * Shows at most once a day and only after real progress, so it reads as
 * encouragement rather than a notification pestering someone who just opened
 * the app.
 */
interface Props {
  goal: Goal;
  isoDate: string;
  completed: number;
  total: number;
}

export default function NutritionToast({ goal, isoDate, completed, total }: Props) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const halfway = total > 0 && completed >= Math.ceil(total / 2);
  const storageKey = `forge:nutritionTip:${isoDate}`;

  useEffect(() => {
    if (!halfway) return;
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, "1");
    setVisible(true);
    const timer = setTimeout(() => dismiss(), 12000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfway, storageKey]);

  function dismiss() {
    setLeaving(true);
    setTimeout(() => setVisible(false), 200);
  }

  if (!visible) return null;

  const tip = tipForDay(goal, isoDate);

  return (
    <div
      role="status"
      className={`fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md transition-all duration-200 sm:inset-x-auto sm:right-6 ${
        leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="glass flex items-start gap-3 rounded-2xl border border-[var(--border-hi)] bg-[var(--surface-hi)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
        <span className="text-xl leading-none">{tip.emoji}</span>
        <p className="min-w-0 flex-1 text-sm text-[var(--text)]">{tip.message}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full px-2 text-lg leading-none text-[var(--text-faint)] hover:text-[var(--text)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
