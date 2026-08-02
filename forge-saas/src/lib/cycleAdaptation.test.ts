import { describe, expect, it } from "vitest";
import {
  adaptForCycle,
  intensityLabel,
  suggestedWeight,
  SYMPTOMS,
  type EnergyLevel,
  type Symptom,
} from "./cycleAdaptation";
import type { CyclePhase } from "./cycle";

const PHASES: CyclePhase[] = ["menstrual", "follicular", "ovulation", "luteal"];
const ENERGIES: (EnergyLevel | null)[] = [null, "low", "medium", "high"];

describe("adaptForCycle", () => {
  it("never suggests below half or above full intensity, for any phase/energy/symptom combination", () => {
    for (const phase of PHASES) {
      for (const energy of ENERGIES) {
        const symptomCases: Symptom[][] = [[], ["cramps"], SYMPTOMS];
        for (const symptoms of symptomCases) {
          const result = adaptForCycle(phase, { energy, symptoms, override: null });
          expect(result.intensity).toBeGreaterThanOrEqual(0.5);
          expect(result.intensity).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("always suggests something to do, never an empty plan", () => {
    for (const phase of PHASES) {
      const worstCase = adaptForCycle(phase, {
        energy: "low",
        symptoms: SYMPTOMS,
        override: null,
      });
      expect(worstCase.ideas.length).toBeGreaterThan(0);
      expect(worstCase.headline.length).toBeGreaterThan(0);
    }
  });

  it("floors at 0.5 intensity in the worst case, rather than reaching zero", () => {
    const worstCase = adaptForCycle("menstrual", {
      energy: "low",
      symptoms: ["cramps", "low_energy", "headache", "back_pain"],
      override: null,
    });
    expect(worstCase.intensity).toBe(0.5);
  });

  it("restores full intensity when the user overrides to train as normal, regardless of symptoms", () => {
    for (const phase of PHASES) {
      const pushed = adaptForCycle(phase, {
        energy: "low",
        symptoms: SYMPTOMS,
        override: "push",
      });
      expect(pushed.intensity).toBe(1);
      expect(pushed.overridden).toBe(true);
    }
  });

  it("never removes a session — the premise that training must stop is not implemented", () => {
    // Codifies a deliberate product decision (docs/kids-mode citing the same
    // standard for children's content applies here too): this function must
    // never return an empty ideas list or a "rest" tone for the menstrual
    // phase on its own.
    const menstrual = adaptForCycle("menstrual", { energy: "medium", symptoms: [], override: null });
    expect(menstrual.ideas.length).toBeGreaterThan(0);
  });
});

describe("intensityLabel", () => {
  it("says 'usual' at full intensity", () => {
    expect(intensityLabel(1)).toBe("Usual working weights");
  });

  it("states the percentage reduction otherwise", () => {
    expect(intensityLabel(0.8)).toBe("About 20% lighter than usual");
  });
});

describe("suggestedWeight", () => {
  it("rounds to the nearest 2.5kg plate increment", () => {
    expect(suggestedWeight(60, 0.8)).toBe(47.5);
  });

  it("never goes negative", () => {
    expect(suggestedWeight(0, 0.5)).toBe(0);
  });

  it("returns the same weight at full intensity", () => {
    expect(suggestedWeight(60, 1)).toBe(60);
  });
});
