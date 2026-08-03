"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PinError, PIN_SESSION_COOKIE_NAME, PIN_SESSION_TTL_MINUTES, verifyPinAndIssueToken } from "@/lib/kids/pin";

/**
 * Deliberately does NOT call requireParentAccess() — a parent whose PIN
 * session just expired is, by definition, mid-way through re-entering, so
 * this only needs a real signed-in user, not the flag re-check (which
 * already happened once to get here, and would only ever redirect back to
 * this same page).
 */
export async function verifyPinAction(pin: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    const { token } = await verifyPinAndIssueToken(supabase, user.id, pin);
    const cookieStore = await cookies();
    cookieStore.set(PIN_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PIN_SESSION_TTL_MINUTES * 60,
      path: "/",
    });
  } catch (err) {
    if (err instanceof PinError) return { error: err.message };
    return { error: "Something went wrong verifying your PIN." };
  }

  return { error: null };
}
