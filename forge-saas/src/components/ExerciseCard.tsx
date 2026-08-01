"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { PrescribedExercise } from "@/lib/exercises/types";
import { MUSCLE_LABELS } from "@/lib/exercises/types";
import type { LoggedSet } from "@/lib/exercises/loggingTypes";
import type { AlternativeOption } from "@/app/dashboard/actions";
import { useSpeech } from "@/hooks/useSpeech";
import {
  exerciseIntroText,
  setLoggedText,
  restStartText,
  restWarningText,
  restEndText,
  allSetsDoneText,
  secondsFromRestString,
  parseVoiceCommand,
} from "@/lib/voiceCoach";

interface Props {
  index: number;
  exercise: PrescribedExercise;
  done: boolean;
  note: string;
  loggedSets: LoggedSet[];
  previousBest: LoggedSet | null;
  voiceEnabled: boolean;
  onToggleDone: () => void;
  onSaveNote: (note: string) => void;
  onLogSet: (setNumber: number, weightKg: number, reps: number) => Promise<{ isNewPR: boolean }>;
  onRequestAlternatives: () => Promise<{ options: AlternativeOption[]; error: string | null }>;
  onSwap: (replacementSlug: string) => Promise<{ error: string | null }>;
}

export default function ExerciseCard({
  index,
  exercise: ex,
  done,
  note,
  loggedSets,
  previousBest,
  voiceEnabled,
  onToggleDone,
  onSaveNote,
  onLogSet,
  onRequestAlternatives,
  onSwap,
}: Props) {
  const [open, setOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapOptions, setSwapOptions] = useState<AlternativeOption[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState(note);
  const [imgError, setImgError] = useState(false);
  const [prFlash, setPrFlash] = useState(false);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const { speak, supportsListening, listenOnce } = useSpeech();
  const announcedRef = useRef(false);

  useEffect(() => {
    if (open && voiceEnabled && !announcedRef.current) {
      announcedRef.current = true;
      speak(exerciseIntroText(ex.name, ex.sets, ex.reps, ex.rest, ex.cues[0]));
    }
    if (!open) announcedRef.current = false;
  }, [open, voiceEnabled, ex, speak]);

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) {
      speak(restEndText(), { interrupt: false });
      setRestRemaining(null);
      return;
    }
    if (restRemaining === 10) speak(restWarningText(10), { interrupt: false });
    const timer = setTimeout(() => setRestRemaining((r) => (r !== null ? r - 1 : r)), 1000);
    return () => clearTimeout(timer);
  }, [restRemaining, speak]);

  function handleSetLogged(setNumber: number, isNewPR: boolean, weightKg: number, reps: number) {
    if (!voiceEnabled) return;
    speak(setLoggedText(setNumber, ex.sets, weightKg, reps, isNewPR), { interrupt: false });
    if (setNumber < ex.sets) {
      const restSeconds = secondsFromRestString(ex.rest);
      speak(restStartText(restSeconds), { interrupt: false });
      setRestRemaining(restSeconds);
    } else {
      speak(allSetsDoneText(ex.name), { interrupt: false });
    }
  }

  async function openSwap() {
    if (swapOpen) {
      setSwapOpen(false);
      return;
    }
    setSwapOpen(true);
    setSwapLoading(true);
    setSwapError(null);
    const result = await onRequestAlternatives();
    setSwapLoading(false);
    if (result.error) setSwapError(result.error);
    else setSwapOptions(result.options);
  }

  async function confirmSwap(replacementSlug: string) {
    setSwapping(replacementSlug);
    setSwapError(null);
    const result = await onSwap(replacementSlug);
    setSwapping(null);
    if (result.error) setSwapError(result.error);
    else setSwapOpen(false);
  }

  const videoUrl =
    ex.videoUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + " proper form tutorial")}`;
  const videoVerified = !!ex.videoUrl;

  return (
    <div
      className={`overflow-hidden rounded-[18px] border bg-[var(--surface)] transition ${
        done ? "border-[rgba(198,255,61,0.45)]" : "border-[var(--border)]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3.5 p-4 text-left"
      >
        <span className="w-5 shrink-0 font-mono text-xs text-[var(--text-faint)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onToggleDone();
            }
          }}
          aria-label="Mark complete"
          className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${
            done
              ? "border-transparent bg-gradient-to-br from-[var(--volt)] to-[#4ade80] text-[#0a0b0f]"
              : "border-[var(--border-hi)] text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="block h-13 w-11 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-2)]">
          {!imgError ? (
            <Image
              src={ex.image}
              alt={ex.name}
              width={44}
              height={52}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-base">🏋️</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-bold">{ex.name}</span>
          <span className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--text-dim)]">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                ex.difficulty === "beginner"
                  ? "bg-[rgba(198,255,61,0.15)] text-[var(--volt)]"
                  : "bg-[rgba(255,176,32,0.15)] text-[var(--amber)]"
              }`}
            >
              {ex.difficulty}
            </span>
            {/* On a phone the sets/rest column is hidden, so carry the numbers
                here — they're the first thing you look for. */}
            <span className="font-mono font-bold text-[var(--text-dim)] sm:hidden">
              {ex.sets}×{ex.reps}
            </span>
            <span className="truncate">{ex.equip}</span>
          </span>
        </span>
        <span className="hidden shrink-0 gap-3.5 text-center sm:flex">
          <span>
            <span className="block font-mono text-sm font-bold">
              {ex.sets}×{ex.reps}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">sets</span>
          </span>
          <span>
            <span className="block font-mono text-sm font-bold">{ex.rest}</span>
            <span className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">rest</span>
          </span>
        </span>
        <span
          className="shrink-0 text-[var(--text-faint)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 pb-5 pt-4">
          <div className="mt-1 grid grid-cols-3 gap-2">
            <Stat label="Sets × Reps" value={`${ex.sets}×${ex.reps}`} />
            <Stat label="Rest" value={ex.rest} />
            <Stat label="Tempo" value={ex.tempo} />
          </div>

          {restRemaining !== null && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--secondary)]/40 bg-[var(--secondary)]/10 px-4 py-2.5 text-sm font-bold text-[var(--secondary)]">
              <span>😮‍💨 Rest</span>
              <span className="font-mono text-lg">{restRemaining}s</span>
            </div>
          )}

          <SetLogger
            targetSets={ex.sets}
            loggedSets={loggedSets}
            previousBest={previousBest}
            prFlash={prFlash}
            voiceEnabled={voiceEnabled}
            supportsListening={supportsListening}
            listenOnce={listenOnce}
            onLogSet={async (setNumber, weightKg, reps) => {
              const result = await onLogSet(setNumber, weightKg, reps);
              if (result.isNewPR) {
                setPrFlash(true);
                setTimeout(() => setPrFlash(false), 4000);
              }
              handleSetLogged(setNumber, result.isNewPR, weightKg, reps);
            }}
          />

          <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] p-4 sm:flex-row">
            {/* Square, not a full-width strip: the photos are square, so a wide
                letterbox would crop the lifter's head and feet off. */}
            <span className="h-[132px] w-[132px] shrink-0 overflow-hidden rounded-xl bg-[var(--surface)] sm:h-[120px] sm:w-[120px]">
              {!imgError ? (
                <Image
                  src={ex.image}
                  alt={`${ex.name} demonstration`}
                  width={240}
                  height={240}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl">📷</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{ex.name}</div>
              <div className="mt-1 text-xs text-[var(--text-dim)]">
                Targets: {ex.primary.map((m) => MUSCLE_LABELS[m]).join(", ")}
                {ex.secondary.length > 0 && ` (+ ${ex.secondary.map((m) => MUSCLE_LABELS[m]).join(", ")})`}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Block title="💨 Breathing">
              <li className="cue">{ex.breathing}</li>
            </Block>
            <Block title="Form cues">
              {ex.cues.map((c) => (
                <li key={c} className="cue">
                  {c}
                </li>
              ))}
            </Block>
            <Block title="Common mistakes">
              {ex.mistakes.map((m) => (
                <li key={m} className="mistake">
                  {m}
                </li>
              ))}
            </Block>
            <Block title="💡 Tip">
              <li className="cue">{ex.tip}</li>
            </Block>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              📝 Notes
            </label>
            <textarea
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--secondary)]"
              rows={2}
              placeholder="How did this feel? Any adjustments?"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => {
                if (noteDraft !== note) onSaveNote(noteDraft);
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3.5 py-2 text-xs font-bold hover:border-[var(--secondary)] hover:text-[var(--secondary)]"
            >
              ▶ {videoVerified ? "Watch demonstration" : "Search proper form"}
            </a>
            <button
              type="button"
              onClick={openSwap}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hi)] bg-[var(--surface-hi)] px-3.5 py-2 text-xs font-bold hover:border-[var(--secondary)] hover:text-[var(--secondary)]"
            >
              🔄 {swapOpen ? "Cancel swap" : "Swap this exercise"}
            </button>
          </div>

          {swapOpen && (
            <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Replace with
              </p>
              <p className="mt-1 text-xs text-[var(--text-dim)]">
                Same muscles, equipment you have. Sets and reps carry over.
              </p>

              {swapLoading && (
                <p className="mt-3 text-sm text-[var(--text-dim)]">Finding alternatives…</p>
              )}
              {swapError && <p className="mt-3 text-sm text-[var(--rose)]">{swapError}</p>}
              {!swapLoading && !swapError && swapOptions.length === 0 && (
                <p className="mt-3 text-sm text-[var(--text-dim)]">
                  No other exercise in your plan trains the same muscles with your equipment.
                </p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {swapOptions.map((option) => (
                  <button
                    key={option.slug}
                    type="button"
                    disabled={swapping !== null}
                    onClick={() => confirmSwap(option.slug)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition hover:border-[var(--secondary)] disabled:opacity-40"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{option.name}</span>
                      <span className="block text-[11px] text-[var(--text-faint)]">
                        {option.equip}
                        {option.match !== "same-muscle" && (
                          <span className="text-[var(--amber)]">
                            {" · "}
                            {option.match === "related"
                              ? "trains related muscles"
                              : "same movement, different muscles"}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[var(--secondary)]">
                      {swapping === option.slug ? "Swapping…" : "Use this"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SetLogger({
  targetSets,
  loggedSets,
  previousBest,
  prFlash,
  voiceEnabled,
  supportsListening,
  listenOnce,
  onLogSet,
}: {
  targetSets: number;
  loggedSets: LoggedSet[];
  previousBest: LoggedSet | null;
  prFlash: boolean;
  voiceEnabled: boolean;
  supportsListening: boolean;
  listenOnce: () => Promise<string>;
  onLogSet: (setNumber: number, weightKg: number, reps: number) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<number, { weight: string; reps: string }>>({});
  const [pending, setPending] = useState<number | null>(null);
  const [listening, setListening] = useState<number | null>(null);
  const loggedByNumber = new Map(loggedSets.map((s) => [s.setNumber, s]));

  async function handleVoiceLog(setNumber: number) {
    setListening(setNumber);
    try {
      const transcript = await listenOnce();
      const command = parseVoiceCommand(transcript);
      if (command.type === "log_set") {
        setPending(setNumber);
        await onLogSet(setNumber, command.weightKg, command.reps);
        setPending(null);
      }
    } catch {
      // Mic denied, no speech detected, or unsupported — silently ignore;
      // the user can still type it in.
    } finally {
      setListening(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
          🏋️ Log your sets
        </h4>
        {previousBest && (
          <span className="text-xs text-[var(--text-dim)]">
            Last time: <b className="text-[var(--text)]">{previousBest.weightKg}kg × {previousBest.reps}</b>
          </span>
        )}
      </div>

      {prFlash && (
        <div className="mb-3 rounded-lg border border-[rgba(255,176,32,0.4)] bg-[rgba(255,176,32,0.12)] px-3 py-2 text-sm font-bold text-[var(--amber)]">
          🏆 New personal record!
        </div>
      )}

      <div className="flex flex-col gap-2">
        {Array.from({ length: targetSets }, (_, i) => i + 1).map((setNumber) => {
          const logged = loggedByNumber.get(setNumber);
          const draft = drafts[setNumber] ?? { weight: "", reps: "" };

          if (logged) {
            return (
              <div
                key={setNumber}
                className="flex items-center gap-3 rounded-lg border border-[rgba(198,255,61,0.3)] bg-[rgba(198,255,61,0.06)] px-3 py-2 text-sm"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-[var(--text-faint)]">Set {setNumber}</span>
                <span className="font-bold text-[var(--volt)]">✓</span>
                <span>
                  {logged.weightKg}kg × {logged.reps} reps
                </span>
              </div>
            );
          }

          return (
            <div key={setNumber} className="flex flex-wrap items-center gap-2">
              <span className="w-12 shrink-0 font-mono text-xs text-[var(--text-faint)]">Set {setNumber}</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="kg"
                value={draft.weight}
                onChange={(e) => setDrafts((d) => ({ ...d, [setNumber]: { ...draft, weight: e.target.value } }))}
                className="w-20 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm outline-none focus:border-[var(--secondary)]"
              />
              <span className="text-xs text-[var(--text-faint)]">kg ×</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="reps"
                value={draft.reps}
                onChange={(e) => setDrafts((d) => ({ ...d, [setNumber]: { ...draft, reps: e.target.value } }))}
                className="w-16 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm outline-none focus:border-[var(--secondary)]"
              />
              <span className="text-xs text-[var(--text-faint)]">reps</span>
              {voiceEnabled && supportsListening && (
                <button
                  type="button"
                  disabled={pending === setNumber || listening !== null}
                  onClick={() => handleVoiceLog(setNumber)}
                  title="Say your weight and reps"
                  className={`rounded-full border px-2 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                    listening === setNumber
                      ? "animate-pulse border-[var(--rose)] text-[var(--rose)]"
                      : "border-[var(--border-hi)] text-[var(--text-dim)] hover:border-[var(--secondary)] hover:text-[var(--secondary)]"
                  }`}
                >
                  {listening === setNumber ? "🎙️ Listening…" : "🎙️"}
                </button>
              )}
              <button
                type="button"
                disabled={!draft.weight || !draft.reps || pending === setNumber}
                onClick={async () => {
                  setPending(setNumber);
                  await onLogSet(setNumber, parseFloat(draft.weight), parseInt(draft.reps, 10));
                  setPending(null);
                }}
                className="ml-auto rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                {pending === setNumber ? "…" : "Log"}
              </button>
            </div>
          );
        })}
      </div>

      {voiceEnabled && supportsListening && (
        <p className="mt-3 text-center text-[11px] text-[var(--text-faint)]">
          🎙️ Tap the mic and say something like &ldquo;60 kilos 10 reps&rdquo;
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2 text-center">
      <b className="block font-mono text-[15px]">{value}</b>
      <span className="text-xs text-[var(--text-dim)]">{label}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
        {title}
      </h4>
      <ul className="flex flex-col gap-1 text-sm text-[var(--text-dim)] [&_.cue]:relative [&_.cue]:pl-4 [&_.cue::before]:absolute [&_.cue::before]:left-0 [&_.cue::before]:font-bold [&_.cue::before]:text-[var(--volt)] [&_.cue::before]:content-['✓'] [&_.mistake]:relative [&_.mistake]:pl-4 [&_.mistake::before]:absolute [&_.mistake::before]:left-0 [&_.mistake::before]:font-bold [&_.mistake::before]:text-[var(--rose)] [&_.mistake::before]:content-['✕']">
        {children}
      </ul>
    </div>
  );
}
