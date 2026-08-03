import { describe, expect, it } from "vitest";
import { validatePinFormat } from "./pin";

describe("validatePinFormat", () => {
  it("accepts 4, 5, and 6 digit numeric PINs", () => {
    expect(validatePinFormat("1234")).toBeNull();
    expect(validatePinFormat("12345")).toBeNull();
    expect(validatePinFormat("123456")).toBeNull();
  });

  it("rejects fewer than 4 or more than 6 digits", () => {
    expect(validatePinFormat("123")).not.toBeNull();
    expect(validatePinFormat("1234567")).not.toBeNull();
  });

  it("rejects non-numeric characters", () => {
    expect(validatePinFormat("12ab")).not.toBeNull();
    expect(validatePinFormat("12 34")).not.toBeNull();
    expect(validatePinFormat("")).not.toBeNull();
  });
});
