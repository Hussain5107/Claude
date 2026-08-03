import { describe, expect, it } from "vitest";
import { hasFeature, hasKidsModeAccess } from "./entitlements";

// This module IS the Kids Mode kill switch (docs/kids-mode/03-architecture-and-data.md
// §6): the flag is `kids_mode` added to AVAILABLE_ON, checked server-side. If
// hasFeature() is wrong, the flag doesn't work — so this gets tested even though
// it is currently a tiny file with only three features in it.

describe("hasFeature", () => {
  it("is available on free for every unrestricted feature", () => {
    expect(hasFeature("free", "cycle_adaptive")).toBe(true);
    expect(hasFeature("free", "ai_export")).toBe(true);
  });

  it("is available on pro for every unrestricted feature", () => {
    expect(hasFeature("pro", "cycle_adaptive")).toBe(true);
    expect(hasFeature("pro", "ai_export")).toBe(true);
  });

  it("treats an unrecognised plan value as free, not as an error and not as pro", () => {
    expect(hasFeature("enterprise", "cycle_adaptive")).toBe(hasFeature("free", "cycle_adaptive"));
    expect(hasFeature(undefined, "cycle_adaptive")).toBe(hasFeature("free", "cycle_adaptive"));
    expect(hasFeature(null, "cycle_adaptive")).toBe(hasFeature("free", "cycle_adaptive"));
  });

  it("kids_mode is closed to every plan while AVAILABLE_ON.kids_mode is empty", () => {
    expect(hasFeature("free", "kids_mode")).toBe(false);
    expect(hasFeature("pro", "kids_mode")).toBe(false);
    expect(hasFeature(undefined, "kids_mode")).toBe(false);
  });
});

describe("hasKidsModeAccess", () => {
  it("is false when the kill switch is closed, even if the account opted in", () => {
    // AVAILABLE_ON.kids_mode is [] today — this must stay false regardless of
    // the per-account column until that array is deliberately opened.
    expect(hasKidsModeAccess("free", true)).toBe(false);
    expect(hasKidsModeAccess("pro", true)).toBe(false);
  });

  it("is false when the per-account column is false, even on a plan the kill switch allows", () => {
    // Simulates the kill switch being opened without this account being on
    // the allow-list — the common case once kids_mode ships to a plan.
    expect(hasKidsModeAccess("free", false)).toBe(false);
    expect(hasKidsModeAccess("free", null)).toBe(false);
    expect(hasKidsModeAccess("free", undefined)).toBe(false);
  });
});
