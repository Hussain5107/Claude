import { describe, expect, it } from "vitest";
import { validateAgeBand, validateAvatarId, validateDisplayName } from "./types";

describe("validateDisplayName", () => {
  it("rejects an empty or whitespace-only name", () => {
    expect(validateDisplayName("")).not.toBeNull();
    expect(validateDisplayName("   ")).not.toBeNull();
  });

  it("rejects a name over 30 characters", () => {
    expect(validateDisplayName("a".repeat(31))).not.toBeNull();
  });

  it("accepts a name at the 30-character boundary", () => {
    expect(validateDisplayName("a".repeat(30))).toBeNull();
  });

  it("accepts an ordinary first name", () => {
    expect(validateDisplayName("Amelia")).toBeNull();
  });
});

describe("validateAgeBand", () => {
  it("accepts the three defined bands", () => {
    expect(validateAgeBand("4-6")).toBe(true);
    expect(validateAgeBand("7-10")).toBe(true);
    expect(validateAgeBand("11-14")).toBe(true);
  });

  it("rejects anything else, including a plausible-looking range", () => {
    expect(validateAgeBand("15-18")).toBe(false);
    expect(validateAgeBand("")).toBe(false);
  });
});

describe("validateAvatarId", () => {
  it("accepts animal-1 through animal-12", () => {
    for (let i = 1; i <= 12; i++) {
      expect(validateAvatarId(`animal-${i}`)).toBe(true);
    }
  });

  it("rejects animal-0, animal-13, and an arbitrary string", () => {
    expect(validateAvatarId("animal-0")).toBe(false);
    expect(validateAvatarId("animal-13")).toBe(false);
    expect(validateAvatarId("not-an-avatar")).toBe(false);
  });
});
