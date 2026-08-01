"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "./ui";
import { deleteCycleData, saveCycleSettings } from "@/app/dashboard/cycle/actions";
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_DURATION } from "@/lib/cycle";

/**
 * Cycle tracking settings.
 *
 * Only rendered for accounts the feature is offered to — the parent decides
 * that, so this component never has to reason about who is looking at it.
 *
 * Turning tracking off stops the adaptation but keeps what was entered, in case
 * it goes back on. Deleting is separate and explicit, because "off" and "erase
 * my health data" are different requests.
 */
interface Props {
  enabled: boolean;
  lastPeriodStart: string | null;
  averageCycleLength: number;
  periodDuration: number;
}

export default function CycleSettingsCard(props: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(props.enabled);
  const [lastPeriodStart, setLastPeriodStart] = useState(props.lastPeriodStart ?? "");
  const [cycleLength, setCycleLength] = useState(String(props.averageCycleLength || DEFAULT_CYCLE_LENGTH));
  const [periodDuration, setPeriodDuration] = useState(String(props.periodDuration || DEFAULT_PERIOD_DURATION));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(nextEnabled = enabled) {
    setSaving(true);
    setError(null);
    const result = await saveCycleSettings({
      enabled: nextEnabled,
      lastPeriodStart: lastPeriodStart || null,
      averageCycleLength: Number(cycleLength),
      periodDuration: Number(periodDuration),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      setEnabled(props.enabled);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteCycleData();
    setDeleting(false);
    setConfirmingDelete(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEnabled(false);
    setLastPeriodStart("");
    setCycleLength(String(DEFAULT_CYCLE_LENGTH));
    setPeriodDuration(String(DEFAULT_PERIOD_DURATION));
    router.refresh();
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--text-faint)]">
        Cycle tracking
      </h2>
      <p className="mb-4 text-sm text-[var(--text-dim)]">
        Optional. FORGE can suggest how heavy to go based on where you are in your cycle, and let
        you log how you feel each day. It never removes a session or tells you not to train.
      </p>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-4 py-3">
        <span className="text-sm font-semibold">Adapt my suggestions to my cycle</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            void save(e.target.checked);
          }}
          className="h-5 w-5 accent-[var(--primary)]"
        />
      </label>

      {enabled && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <Label htmlFor="lastPeriodStart">First day of your last period</Label>
            <Input
              id="lastPeriodStart"
              type="date"
              value={lastPeriodStart}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setLastPeriodStart(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              Everything is counted from this date, so updating it every month or two keeps the
              suggestions useful. Leave it blank and nothing is calculated.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cycleLength">Cycle length (days)</Label>
              <Input
                id="cycleLength"
                type="number"
                min={20}
                max={45}
                value={cycleLength}
                onChange={(e) => setCycleLength(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="periodDuration">Period length (days)</Label>
              <Input
                id="periodDuration"
                type="number"
                min={1}
                max={10}
                value={periodDuration}
                onChange={(e) => setPeriodDuration(e.target.value)}
              />
            </div>
          </div>

          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save cycle settings"}
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[var(--rose)]">{error}</p>}

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <p className="text-xs text-[var(--text-faint)]">
          Only you can read this. It isn&apos;t shared, isn&apos;t included in the training export,
          and isn&apos;t used for anything except the suggestion on your dashboard.
        </p>
        {confirmingDelete ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void handleDelete()} disabled={deleting} className="px-4 py-2 text-xs">
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </Button>
            <Button onClick={() => setConfirmingDelete(false)} className="px-4 py-2 text-xs">
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-3 text-xs font-bold text-[var(--rose)]"
          >
            Delete my cycle data
          </button>
        )}
      </div>
    </Card>
  );
}
