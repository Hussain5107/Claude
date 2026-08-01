/**
 * Turns a cycle phase and today's check-in into a training suggestion.
 *
 * Two honest caveats are built into how this is worded everywhere it appears:
 *
 * 1. The research on training around the cycle is genuinely mixed. Some people
 *    feel a large difference across phases and some feel none, and studies have
 *    not shown that phase-based periodisation reliably beats simply training
 *    consistently. So this suggests, it never prescribes, and it never removes
 *    a session — nobody is told they can't train on their period.
 * 2. How you actually feel today beats any calendar. A check-in always outranks
 *    the phase, and "train as normal" is one tap away.
 *
 * `intensity` is a multiplier on the user's usual working weight. It is only
 * ever a suggestion shown next to their own last logged numbers.
 */

import type { CyclePhase } from "./cycle";

export type EnergyLevel = "low" | "medium" | "high";

export type Symptom = "cramps" | "low_energy" | "headache" | "back_pain" | "bloating" | "mood";

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  cramps: "Cramps",
  low_energy: "Fatigue",
  headache: "Headache",
  back_pain: "Back pain",
  bloating: "Bloating",
  mood: "Mood changes",
};

export const SYMPTOMS: Symptom[] = ["cramps", "low_energy", "headache", "back_pain", "bloating", "mood"];

export interface CheckIn {
  energy: EnergyLevel | null;
  symptoms: Symptom[];
  override: "follow" | "push" | null;
}

export interface Adaptation {
  /** Multiplier on usual working weight, 0.5–1.0. */
  intensity: number;
  headline: string;
  reason: string;
  /** What today could look like, in the user's own equipment terms. */
  ideas: string[];
  tone: "recover" | "steady" | "push";
  /** Set when the user has chosen to train as normal, so the UI can say so. */
  overridden: boolean;
}

interface PhaseProfile {
  intensity: number;
  headline: string;
  reason: string;
  ideas: string[];
  tone: Adaptation["tone"];
}

const PHASE_PROFILES: Record<CyclePhase, PhaseProfile> = {
  menstrual: {
    intensity: 0.85,
    headline: "Train, but keep something in the tank",
    reason:
      "Plenty of people lift normally through their period, and plenty feel flat. Start with your usual warm-up and let the first working set tell you which one today is.",
    ideas: ["Full session at a lighter load", "Mobility and stretching", "A 20–30 minute walk"],
    tone: "recover",
  },
  follicular: {
    intensity: 1,
    headline: "A good stretch for pushing progress",
    reason:
      "Energy tends to climb after your period ends. If you're going to add weight or chase a rep, this is a sensible week to try it.",
    ideas: ["Add a little weight to your main lift", "Go for the top of your rep range"],
    tone: "push",
  },
  ovulation: {
    intensity: 1,
    headline: "Often the strongest stretch of the month",
    reason:
      "Many people report their best sessions around here. Worth a proper attempt at your main lift — warm up thoroughly first.",
    ideas: ["Attempt a PR on your main lift", "Full sets, full rest"],
    tone: "push",
  },
  luteal: {
    intensity: 0.95,
    headline: "Steady work suits this stretch",
    reason:
      "Sessions can feel harder for the same weight in the days before a period. Holding your numbers here is a win, not a plateau.",
    ideas: ["Keep last week's weights", "Add an extra minute of rest between sets", "Steady cardio"],
    tone: "steady",
  },
};

/** Symptoms that most often make loaded training uncomfortable. */
const HEAVY_SYMPTOMS: Symptom[] = ["cramps", "low_energy", "headache", "back_pain"];

export function adaptForCycle(phase: CyclePhase, checkIn: CheckIn | null): Adaptation {
  const base = PHASE_PROFILES[phase];

  // The user's explicit "I'm training as normal" ends the conversation.
  if (checkIn?.override === "push") {
    return {
      intensity: 1,
      headline: "Training as normal today",
      reason: "You know how you feel better than a calendar does. Full session, usual weights.",
      ideas: base.ideas,
      tone: "push",
      overridden: true,
    };
  }

  let intensity = base.intensity;
  let headline = base.headline;
  let reason = base.reason;
  let tone = base.tone;
  let ideas = base.ideas;

  const heavySymptoms = (checkIn?.symptoms ?? []).filter((s) => HEAVY_SYMPTOMS.includes(s)).length;

  if (checkIn?.energy === "low") {
    intensity -= 0.2;
    tone = "recover";
    headline = "Lower the bar for today";
    reason =
      "You said your energy is low. Turning up and doing something easy keeps the habit intact, which matters far more than any single session.";
    ideas = ["Half the usual weight, same reps", "Mobility and stretching", "A walk instead"];
  } else if (checkIn?.energy === "high") {
    // Feeling good outranks the phase's caution, but not by much during a
    // period — enthusiasm on day 1 is still day 1.
    intensity = Math.min(1, intensity + 0.1);
    if (tone === "recover") tone = "steady";
  }

  // Each symptom that makes loading uncomfortable takes a little more off.
  intensity -= heavySymptoms * 0.05;

  if (heavySymptoms > 0 && checkIn?.energy !== "low") {
    reason = `${reason} You've flagged ${heavySymptoms === 1 ? "a symptom" : "a few symptoms"} today, so the suggested load is a bit lower than usual.`;
  }

  return {
    intensity: round(Math.min(1, Math.max(0.5, intensity))),
    headline,
    reason,
    ideas,
    tone,
    overridden: false,
  };
}

/** "Take about 15% off" — phrased as a reduction because that's the decision. */
export function intensityLabel(intensity: number): string {
  const off = Math.round((1 - intensity) * 100);
  if (off <= 0) return "Usual working weights";
  return `About ${off}% lighter than usual`;
}

/** Suggested load for one exercise, from the user's own last logged set. */
export function suggestedWeight(lastWeightKg: number, intensity: number): number {
  // Rounded to 2.5 kg because that's the smallest plate pair on most racks.
  return Math.max(0, Math.round((lastWeightKg * intensity) / 2.5) * 2.5);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
