"use client";

import { useState } from "react";
import type { CardioPlan } from "@/lib/cardio";

/**
 * Warm-up and cool-down lists, and the optional cardio block.
 *
 * All of it is genuinely optional — these tick off independently and never
 * count toward the day's "X / Y done", so skipping the warm-up doesn't make a
 * completed session look unfinished.
 */

interface PrepListProps {
  title: string;
  hint: string;
  items: string[];
  /** Namespaces the saved state so a warm-up item can't collide with an
   *  exercise slug or with the cool-down list. */
  slugPrefix: string;
  isChecked: (slug: string) => boolean;
  onToggle: (slug: string) => void;
}

export function PrepList({ title, hint, items, slugPrefix, isChecked, onToggle }: PrepListProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const doneCount = items.filter((_, i) => isChecked(`${slugPrefix}:${i}`)).length;

  return (
    <div className="glass mb-5 rounded-2xl border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold">{title}</span>
          <span className="rounded-full bg-[var(--surface-hi)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
            Optional
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
          {doneCount > 0 && (
            <span className="font-mono text-[var(--volt)]">
              {doneCount}/{items.length}
            </span>
          )}
          <span style={{ transform: open ? "rotate(180deg)" : "none" }}>▾</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-[var(--text-dim)]">{hint}</p>
          <div className="flex flex-col gap-1.5">
            {items.map((item, i) => {
              const slug = `${slugPrefix}:${i}`;
              const checked = isChecked(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onToggle(slug)}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--surface-hi)]"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black ${
                      checked
                        ? "border-transparent bg-gradient-to-br from-[var(--volt)] to-[#4ade80] text-[#0a0b0f]"
                        : "border-[var(--border-hi)] text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span
                    className={`text-sm ${checked ? "text-[var(--text-faint)] line-through" : "text-[var(--text-dim)]"}`}
                  >
                    {item}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CardioCard({ plan }: { plan: CardioPlan }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass mb-5 rounded-2xl border border-[var(--border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold">🚴 Cardio</span>
          <span className="rounded-full bg-[var(--surface-hi)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
            Optional
          </span>
        </span>
        <span className="text-xs text-[var(--text-faint)]">
          <span style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>
            ▾
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                Before lifting
              </div>
              <div className="mt-1 text-sm text-[var(--text-dim)]">{plan.warmup}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                Separate session
              </div>
              <div className="mt-1 text-sm text-[var(--text-dim)]">{plan.session}</div>
              <div className="mt-1 text-xs text-[var(--secondary)]">{plan.frequency}</div>
            </div>
          </div>

          <p className="mt-3 text-xs text-[var(--text-faint)]">{plan.why}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {plan.options.map((option) => (
              <span
                key={option}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-dim)]"
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
