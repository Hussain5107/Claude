import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { createClient } from "@/lib/supabase/server";

/**
 * The parent PIN gate for re-entering /parent from Kids Mode.
 *
 * docs/kids-mode/00-principles.md P2, stated as plainly as it can be: "A PIN
 * to leave kid mode is a UX feature, never a security boundary." The actual
 * boundary is auth.uid() = parent_user_id on every table and every Server
 * Action, enforced identically whether or not a PIN session cookie is
 * present. This module exists to make swapping screens on a shared device
 * pleasant, not to gate access to anything a plain getUser() check doesn't
 * already gate.
 */

const PIN_SALT_ROUNDS = 10;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;
export const PIN_SESSION_TTL_MINUTES = 15;
export const PIN_SESSION_COOKIE_NAME = "parent_pin_session";
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 6;

export class PinError extends Error {
  constructor(
    message: string,
    public code: "INVALID_FORMAT" | "ALREADY_EXISTS" | "NOT_FOUND" | "INCORRECT" | "LOCKED" | "DB_ERROR",
  ) {
    super(message);
    this.name = "PinError";
  }
}

/** Pure — no I/O. 4-6 numeric digits, nothing else. */
export function validatePinFormat(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return "PIN must contain only numbers.";
  if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
    return `PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits.`;
  }
  return null;
}

// Deliberately no fallback default here. A PIN session token signed with a
// guessable string would be a real weakness even though the PIN itself is
// UX-only (P2) — the token still controls whether a child sees the "enter
// PIN" screen again immediately, and a forged one shouldn't be free. Fails
// loudly at first use instead, same as this app's Supabase env vars
// (process.env.X! elsewhere in src/lib/supabase/*).
function getPinSecret(): Uint8Array {
  const secret = process.env.PIN_SESSION_SECRET;
  if (!secret) {
    throw new PinError("PIN_SESSION_SECRET is not configured.", "DB_ERROR");
  }
  return new TextEncoder().encode(secret);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface ParentPinRow {
  pin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
}

export async function hasPinSetup(supabase: Supabase, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("parent_pins").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new PinError(error.message, "DB_ERROR");
  return !!data;
}

/** Fails if a PIN already exists — the caller should route to resetPin instead. */
export async function setupPin(supabase: Supabase, userId: string, pin: string): Promise<void> {
  const formatError = validatePinFormat(pin);
  if (formatError) throw new PinError(formatError, "INVALID_FORMAT");

  if (await hasPinSetup(supabase, userId)) {
    throw new PinError("A PIN is already set up. Use reset to change it.", "ALREADY_EXISTS");
  }

  const pinHash = await bcrypt.hash(pin, PIN_SALT_ROUNDS);
  const { error } = await supabase.from("parent_pins").insert({ user_id: userId, pin_hash: pinHash });
  if (error) throw new PinError(error.message, "DB_ERROR");
}

/**
 * Check a PIN attempt, tracking lockout. Returns a signed session token on
 * success — the caller (a Server Action) is responsible for writing it to a
 * cookie via next/headers.
 */
export async function verifyPinAndIssueToken(
  supabase: Supabase,
  userId: string,
  pin: string,
): Promise<{ token: string; expiresAt: string }> {
  const formatError = validatePinFormat(pin);
  if (formatError) throw new PinError(formatError, "INVALID_FORMAT");

  const { data, error } = await supabase
    .from("parent_pins")
    .select("pin_hash, failed_attempts, locked_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new PinError(error.message, "DB_ERROR");
  if (!data) throw new PinError("No PIN is set up yet.", "NOT_FOUND");

  const row = data as ParentPinRow;

  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const remainingMin = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000);
    throw new PinError(`Too many attempts. Try again in ${remainingMin} minute(s).`, "LOCKED");
  }

  const isValid = await bcrypt.compare(pin, row.pin_hash);

  if (!isValid) {
    const attempts = row.failed_attempts + 1;
    const update: Record<string, unknown> = { failed_attempts: attempts };
    if (attempts >= PIN_MAX_ATTEMPTS) {
      update.locked_until = new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000).toISOString();
    }
    await supabase.from("parent_pins").update(update).eq("user_id", userId);

    if (attempts >= PIN_MAX_ATTEMPTS) {
      throw new PinError(`Too many attempts. Locked for ${PIN_LOCKOUT_MINUTES} minutes.`, "LOCKED");
    }
    throw new PinError(`Incorrect PIN. ${PIN_MAX_ATTEMPTS - attempts} attempt(s) left.`, "INCORRECT");
  }

  await supabase.from("parent_pins").update({ failed_attempts: 0, locked_until: null }).eq("user_id", userId);

  const expiresAt = new Date(Date.now() + PIN_SESSION_TTL_MINUTES * 60_000);
  const token = await new SignJWT({ userId, purpose: "pin_session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getPinSecret());

  return { token, expiresAt: expiresAt.toISOString() };
}

/** Whether a PIN session cookie is a valid, unexpired token for this exact user. UX gate only — see the module header. */
export async function isPinSessionValid(token: string | undefined, userId: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getPinSecret());
    return payload.purpose === "pin_session" && payload.userId === userId;
  } catch {
    return false;
  }
}

export async function resetPin(supabase: Supabase, userId: string, newPin: string): Promise<void> {
  const formatError = validatePinFormat(newPin);
  if (formatError) throw new PinError(formatError, "INVALID_FORMAT");

  const pinHash = await bcrypt.hash(newPin, PIN_SALT_ROUNDS);
  const { error } = await supabase
    .from("parent_pins")
    .upsert({ user_id: userId, pin_hash: pinHash, failed_attempts: 0, locked_until: null });
  if (error) throw new PinError(error.message, "DB_ERROR");
}

export async function removePin(supabase: Supabase, userId: string): Promise<void> {
  const { error } = await supabase.from("parent_pins").delete().eq("user_id", userId);
  if (error) throw new PinError(error.message, "DB_ERROR");
}
