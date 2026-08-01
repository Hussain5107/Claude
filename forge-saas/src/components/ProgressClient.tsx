"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { estimated1RM } from "@/lib/tracking";
import { createClient } from "@/lib/supabase/client";
import { saveProgressPhoto, deleteProgressPhoto } from "@/app/dashboard/progress/actions";
import { Card, Input } from "./ui";
import AppHeader from "./AppHeader";
import AiCoachPanel from "./AiCoachPanel";

interface SetRow {
  log_date: string;
  exercise_slug: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  logged_at: string;
}

interface PRRow {
  exercise_slug: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;
  achieved_at: string;
}

interface PhotoRow {
  id: string;
  photo_url: string;
  taken_at: string;
  note: string | null;
}

interface Props {
  sets: SetRow[];
  personalRecords: PRRow[];
  streak: { current: number; longest: number; total: number };
  userId: string;
  photos: PhotoRow[];
}

export default function ProgressClient({ sets, personalRecords, streak, userId, photos: initialPhotos }: Props) {
  const exerciseNames = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of sets) seen.set(s.exercise_slug, s.exercise_name);
    return [...seen.entries()];
  }, [sets]);

  const [selectedSlug, setSelectedSlug] = useState(exerciseNames[0]?.[0] ?? "");

  const chartPoints = useMemo(() => {
    return sets
      .filter((s) => s.exercise_slug === selectedSlug)
      .map((s) => ({ date: s.log_date, value: estimated1RM(s.weight_kg, s.reps) }));
  }, [sets, selectedSlug]);

  const weeklyVolume = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const s of sets) {
      const weekKey = isoWeekKey(s.log_date);
      byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + s.weight_kg * s.reps);
    }
    return [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-8);
  }, [sets]);

  const currentPRs = useMemo(() => {
    const seen = new Set<string>();
    const list: PRRow[] = [];
    for (const pr of personalRecords) {
      if (seen.has(pr.exercise_slug)) continue;
      seen.add(pr.exercise_slug);
      list.push(pr);
    }
    return list;
  }, [personalRecords]);

  const [photos, setPhotos] = useState(initialPhotos);
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().slice(0, 10));
  const [photoNote, setPhotoNote] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setPhotoError(null);
    const supabase = createClient();
    const path = `${userId}/progress/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("progress-photos").upload(path, file);
    if (error) {
      setPhotoError(error.message);
    } else {
      const { data } = supabase.storage.from("progress-photos").getPublicUrl(path);
      const result = await saveProgressPhoto(data.publicUrl, photoDate, photoNote);
      if (result.error) {
        setPhotoError(result.error);
      } else {
        setPhotos((prev) =>
          [{ id: crypto.randomUUID(), photo_url: data.publicUrl, taken_at: photoDate, note: photoNote || null }, ...prev].sort(
            (a, b) => (a.taken_at < b.taken_at ? 1 : -1),
          ),
        );
        setPhotoNote("");
      }
    }
    setUploadingPhoto(false);
    e.target.value = "";
  }

  async function handleDeletePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const result = await deleteProgressPhoto(id);
    if (result.error) setPhotoError(result.error);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      <AppHeader title="Progress" subtitle="Everything you've logged" />

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Current streak" value={`${streak.current}d`} accent="var(--amber)" />
        <StatTile label="Longest streak" value={`${streak.longest}d`} accent="var(--volt)" />
        <StatTile label="Workouts logged" value={String(streak.total)} accent="var(--secondary)" />
      </div>

      {sets.length === 0 ? (
        <Card className="mt-6 p-10 text-center text-sm text-[var(--text-dim)]">
          No sets logged yet. Log your first set from today's workout and your charts will show up
          here.
        </Card>
      ) : (
        <>
          <Card className="mt-6 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold">Estimated 1RM over time</h2>
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-1.5 text-sm outline-none"
              >
                {exerciseNames.map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            {chartPoints.length >= 2 ? (
              <LineChart points={chartPoints.map((p) => p.value)} labels={chartPoints.map((p) => p.date)} />
            ) : (
              <p className="py-10 text-center text-sm text-[var(--text-faint)]">
                Log at least 2 sets of this exercise to see a trend.
              </p>
            )}
          </Card>

          <Card className="mt-6 p-5">
            <h2 className="mb-4 text-sm font-bold">Weekly volume (total kg lifted)</h2>
            {weeklyVolume.length >= 1 ? (
              <BarChart bars={weeklyVolume.map(([week, vol]) => ({ label: week, value: vol }))} />
            ) : (
              <p className="py-10 text-center text-sm text-[var(--text-faint)]">No data yet.</p>
            )}
          </Card>

          <Card className="mt-6 p-5">
            <h2 className="mb-4 text-sm font-bold">Personal records</h2>
            {currentPRs.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">No PRs yet — log a set to set your first one.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {currentPRs.map((pr) => (
                  <div
                    key={pr.exercise_slug}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] py-2 text-sm last:border-none"
                  >
                    <span>{pr.exercise_name}</span>
                    <span className="font-mono font-bold text-[var(--volt)]">
                      {pr.weight_kg}kg × {pr.reps} <span className="text-[var(--text-faint)]">(~{pr.estimated_1rm}kg 1RM)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Card className="mt-6 p-5">
        <h2 className="mb-4 text-sm font-bold">Progress photos</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1" style={{ minWidth: 140 }}>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Date
            </label>
            <Input type="date" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} />
          </div>
          <div className="flex-1" style={{ minWidth: 140 }}>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Note (optional)
            </label>
            <Input placeholder="e.g. Month 2" value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} />
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] px-4 py-2.5 text-xs font-bold hover:border-[var(--secondary)]">
              {uploadingPhoto ? "Uploading…" : "📷 Add photo"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </div>
        {photoError && <p className="mt-3 text-sm text-[var(--rose)]">Couldn&apos;t save photo: {photoError}</p>}

        {photos.length === 0 ? (
          <p className="mt-5 text-sm text-[var(--text-faint)]">
            No progress photos yet — add one today, then come back in a month to see the difference.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-[var(--border)]">
                <a href={p.photo_url} target="_blank" rel="noopener noreferrer">
                  <Image src={p.photo_url} alt={p.note ?? p.taken_at} fill className="object-cover" />
                </a>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <div className="text-[10px] font-bold text-white">{p.taken_at}</div>
                  {p.note && <div className="truncate text-[10px] text-white/70">{p.note}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(p.id)}
                  className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
                  aria-label="Delete photo"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <AiCoachPanel />
    </main>
  );
}

function isoWeekKey(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 1 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <div className="font-mono text-2xl font-extrabold" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
    </div>
  );
}

function LineChart({ points, labels }: { points: number[]; labels: string[] }) {
  const w = 600;
  const h = 180;
  const pad = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Estimated 1RM progress chart">
      <defs>
        <linearGradient id="progress-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#progress-fill)" />
      <path d={path} fill="none" stroke="var(--secondary)" strokeWidth="2.5" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--secondary)" />
      ))}
      <text x={pad} y={14} className="fill-current text-[10px]" style={{ fill: "var(--text-faint)" }}>
        {labels[0]}
      </text>
      <text x={w - pad} y={14} textAnchor="end" className="fill-current text-[10px]" style={{ fill: "var(--text-faint)" }}>
        {labels[labels.length - 1]}
      </text>
    </svg>
  );
}

function BarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex items-end gap-3" style={{ height: 160 }}>
      {bars.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-[var(--primary)] to-[var(--secondary)]"
            style={{ height: `${(b.value / max) * 120}px` }}
            title={`${Math.round(b.value)} kg`}
          />
          <span className="text-[9px] text-[var(--text-faint)]">{b.label.split("-W")[1]}</span>
        </div>
      ))}
    </div>
  );
}
