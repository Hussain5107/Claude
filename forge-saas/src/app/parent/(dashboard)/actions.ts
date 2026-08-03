"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  ChildProfileError,
  createChildProfile,
  deleteChildProfile,
  requireParentAccess,
  updateChildProfile,
} from "@/lib/kids/kidsServer";
import { PinError, PIN_SESSION_COOKIE_NAME, removePin, resetPin, setupPin } from "@/lib/kids/pin";
import { validateAgeBand, validateAvatarId, validateDisplayName, type AgeBand } from "@/lib/kids/types";

export interface CreateChildInput {
  displayName: string;
  ageBand: string;
  avatarId: string;
}

export async function createChildAction(input: CreateChildInput): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireParentAccess();

  const nameError = validateDisplayName(input.displayName);
  if (nameError) return { error: nameError };
  if (!validateAgeBand(input.ageBand)) return { error: "Choose an age band." };
  if (!validateAvatarId(input.avatarId)) return { error: "Choose an avatar." };

  try {
    await createChildProfile(supabase, userId, {
      displayName: input.displayName,
      ageBand: input.ageBand as AgeBand,
      avatarId: input.avatarId,
    });
  } catch (err) {
    if (err instanceof ChildProfileError) return { error: err.message };
    return { error: "Something went wrong creating that profile." };
  }

  revalidatePath("/parent");
  return { error: null };
}

export interface UpdateChildInput {
  id: string;
  displayName: string;
  ageBand: string;
  avatarId: string;
}

export async function updateChildAction(input: UpdateChildInput): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireParentAccess();

  const nameError = validateDisplayName(input.displayName);
  if (nameError) return { error: nameError };
  if (!validateAgeBand(input.ageBand)) return { error: "Choose an age band." };
  if (!validateAvatarId(input.avatarId)) return { error: "Choose an avatar." };

  try {
    await updateChildProfile(supabase, userId, input.id, {
      displayName: input.displayName,
      ageBand: input.ageBand as AgeBand,
      avatarId: input.avatarId,
    });
  } catch (err) {
    if (err instanceof ChildProfileError) return { error: err.message };
    return { error: "Something went wrong saving that profile." };
  }

  revalidatePath("/parent");
  return { error: null };
}

export async function deleteChildAction(id: string): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireParentAccess();

  try {
    await deleteChildProfile(supabase, userId, id);
  } catch (err) {
    if (err instanceof ChildProfileError) return { error: err.message };
    return { error: "Something went wrong deleting that profile." };
  }

  revalidatePath("/parent");
  return { error: null };
}

export async function setupPinAction(pin: string): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireParentAccess();
  try {
    await setupPin(supabase, userId, pin);
  } catch (err) {
    if (err instanceof PinError) return { error: err.message };
    return { error: "Something went wrong setting up your PIN." };
  }
  revalidatePath("/parent");
  return { error: null };
}

/** Requires the account's password, same as changing it — see cycle/actions.ts-style re-auth for a sensitive change. */
export async function resetPinAction(currentPassword: string, newPin: string): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireParentAccess();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not signed in." };

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "Current password is incorrect." };

  try {
    await resetPin(supabase, userId, newPin);
  } catch (err) {
    if (err instanceof PinError) return { error: err.message };
    return { error: "Something went wrong resetting your PIN." };
  }

  // A changed PIN invalidates any PIN session in progress on this device —
  // require it again rather than leaving a stale cookie valid.
  const cookieStore = await cookies();
  cookieStore.delete(PIN_SESSION_COOKIE_NAME);

  revalidatePath("/parent");
  return { error: null };
}

export async function removePinAction(currentPassword: string): Promise<{ error: string | null }> {
  const { supabase, userId } = await requireParentAccess();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not signed in." };

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "Current password is incorrect." };

  try {
    await removePin(supabase, userId);
  } catch (err) {
    if (err instanceof PinError) return { error: err.message };
    return { error: "Something went wrong removing your PIN." };
  }

  const cookieStore = await cookies();
  cookieStore.delete(PIN_SESSION_COOKIE_NAME);

  revalidatePath("/parent");
  return { error: null };
}

