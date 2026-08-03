import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasKidsModeAccess } from "@/lib/entitlements";
import {
  MAX_CHILD_PROFILES_PER_ACCOUNT,
  mapChildProfileRow,
  type ChildProfile,
  type ChildProfileRow,
  type CreateChildProfileInput,
  type UpdateChildProfileInput,
} from "./types";

/**
 * Server-side helpers for child profile ownership and CRUD.
 *
 * Kept out of the actions file so they can be plain functions: a "use server"
 * module may only export async server actions — same reason src/lib/cycleServer.ts
 * exists. Every function here takes the CALLER'S Supabase client and the
 * caller's own user id explicitly, rather than resolving them internally —
 * RLS already restricts every query to the caller's own rows, and passing
 * parentUserId in explicitly makes that boundary readable at the call site
 * too (docs/kids-mode/00-principles.md P2: never trust the caller, re-check).
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Re-checks auth AND the flag from scratch — called at the top of every Kids
 * Mode Server Action, not just the layouts. docs/kids-mode/00-principles.md
 * P2: "a hidden button is not a permission." A caller that reaches here
 * without both layers open gets redirected to /parent, which itself 404s via
 * the layout — never a silent pass-through.
 */
export async function requireParentAccess(): Promise<{ supabase: Supabase; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, kids_mode_enabled")
    .eq("id", user.id)
    .single();

  if (!hasKidsModeAccess(profile?.plan, profile?.kids_mode_enabled)) {
    redirect("/parent");
  }

  return { supabase, userId: user.id };
}

export class ChildProfileError extends Error {
  constructor(
    message: string,
    public code: "VALIDATION_ERROR" | "LIMIT_EXCEEDED" | "NOT_FOUND" | "DB_ERROR",
  ) {
    super(message);
    this.name = "ChildProfileError";
  }
}

/** All of a parent's children, ordered for a stable picker UI. */
export async function listChildProfiles(supabase: Supabase, parentUserId: string): Promise<ChildProfile[]> {
  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("parent_user_id", parentUserId)
    .order("child_index", { ascending: true });

  if (error) throw new ChildProfileError(error.message, "DB_ERROR");
  return ((data ?? []) as ChildProfileRow[]).map(mapChildProfileRow);
}

/**
 * Resolve a child by its per-parent index (the /kids/[index] URL segment),
 * scoped to the given parent. Returns null both when the row doesn't exist
 * and when it belongs to someone else — the caller should respond with 404
 * either way, never 403, so a guess doesn't confirm a child exists
 * (docs/kids-mode/03-architecture-and-data.md §2).
 */
export async function resolveChildByIndex(
  supabase: Supabase,
  parentUserId: string,
  childIndex: number,
): Promise<ChildProfile | null> {
  if (!Number.isInteger(childIndex) || childIndex < 1 || childIndex > MAX_CHILD_PROFILES_PER_ACCOUNT) {
    return null;
  }

  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("parent_user_id", parentUserId)
    .eq("child_index", childIndex)
    .maybeSingle();

  if (error) throw new ChildProfileError(error.message, "DB_ERROR");
  return data ? mapChildProfileRow(data as ChildProfileRow) : null;
}

/** Same resolution, by row id rather than index — used after a mutation to re-read the row. */
export async function getChildProfileById(
  supabase: Supabase,
  parentUserId: string,
  id: string,
): Promise<ChildProfile | null> {
  const { data, error } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("parent_user_id", parentUserId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new ChildProfileError(error.message, "DB_ERROR");
  return data ? mapChildProfileRow(data as ChildProfileRow) : null;
}

async function nextChildIndex(supabase: Supabase, parentUserId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("child_profiles")
    .select("child_index")
    .eq("parent_user_id", parentUserId);

  if (error) throw new ChildProfileError(error.message, "DB_ERROR");

  const taken = new Set((data ?? []).map((row) => (row as { child_index: number }).child_index));
  for (let i = 1; i <= MAX_CHILD_PROFILES_PER_ACCOUNT; i++) {
    if (!taken.has(i)) return i;
  }
  return null;
}

export async function createChildProfile(
  supabase: Supabase,
  parentUserId: string,
  input: CreateChildProfileInput,
): Promise<ChildProfile> {
  const childIndex = await nextChildIndex(supabase, parentUserId);
  if (childIndex === null) {
    throw new ChildProfileError(
      `You can have up to ${MAX_CHILD_PROFILES_PER_ACCOUNT} child profiles.`,
      "LIMIT_EXCEEDED",
    );
  }

  const { data, error } = await supabase
    .from("child_profiles")
    .insert({
      parent_user_id: parentUserId,
      child_index: childIndex,
      display_name: input.displayName.trim(),
      age_band: input.ageBand,
      avatar_id: input.avatarId ?? "animal-1",
    })
    .select()
    .single();

  if (error) throw new ChildProfileError(error.message, "DB_ERROR");
  return mapChildProfileRow(data as ChildProfileRow);
}

export async function updateChildProfile(
  supabase: Supabase,
  parentUserId: string,
  id: string,
  input: UpdateChildProfileInput,
): Promise<ChildProfile> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.displayName !== undefined) updateData.display_name = input.displayName.trim();
  if (input.ageBand !== undefined) updateData.age_band = input.ageBand;
  if (input.avatarId !== undefined) updateData.avatar_id = input.avatarId;

  const { data, error } = await supabase
    .from("child_profiles")
    .update(updateData)
    .eq("parent_user_id", parentUserId)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw new ChildProfileError(error.message, "DB_ERROR");
  if (!data) throw new ChildProfileError("That child profile doesn't exist.", "NOT_FOUND");
  return mapChildProfileRow(data as ChildProfileRow);
}

export async function deleteChildProfile(supabase: Supabase, parentUserId: string, id: string): Promise<void> {
  const { error, count } = await supabase
    .from("child_profiles")
    .delete({ count: "exact" })
    .eq("parent_user_id", parentUserId)
    .eq("id", id);

  if (error) throw new ChildProfileError(error.message, "DB_ERROR");
  if (!count) throw new ChildProfileError("That child profile doesn't exist.", "NOT_FOUND");
}
