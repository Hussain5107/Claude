import { describe, expect, it } from "vitest";
import { hasFeature } from "./entitlements";

// This module IS the Kids Mode kill switch (docs/kids-mode/03-architecture-and-data.md
// §6): the flag is `kids_mode` added to AVAILABLE_ON, checked server-side. If
// hasFeature() is wrong, the flag doesn't work — so this gets tested even though
// it is currently a tiny file with only two features in it.

describe("hasFeature", () => {
  it("is available on free for every currently-listed feature", () => {
    expect(hasFeature("free", "cycle_adaptive")).toBe(true);
    expect(hasFeature("free", "ai_export")).toBe(true);
  });

  it("is available on pro for every currently-listed feature", () => {
    expect(hasFeature("pro", "cycle_adaptive")).toBe(true);
    expect(hasFeature("pro", "ai_export")).toBe(true);
  });

  it("treats an unrecognised plan value as free, not as an error and not as pro", () => {
    expect(hasFeature("enterprise", "cycle_adaptive")).toBe(hasFeature("free", "cycle_adaptive"));
    expect(hasFeature(undefined, "cycle_adaptive")).toBe(hasFeature("free", "cycle_adaptive"));
    expect(hasFeature(null, "cycle_adaptive")).toBe(hasFeature("free", "cycle_adaptive"));
  });

});

// When a `kids_mode` feature is added (see docs/kids-mode/03-architecture-and-data.md
// §6 — it should start as `[]`, available to nobody), add a case here proving
// hasFeature(anyPlan, "kids_mode") is false while the allow-list is empty. Left
// as a comment rather than a test against a feature that doesn't exist yet,
// which would be testing a string literal, not this function.
