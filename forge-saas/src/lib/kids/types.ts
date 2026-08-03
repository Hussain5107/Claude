/**
 * Kids Mode's shared shapes and pure validation.
 *
 * Deliberately no Supabase import here — see docs/kids-mode/03-architecture-and-data.md
 * §1's import rules. Anything that needs a database client lives in kidsServer.ts.
 */

export type AgeBand = "4-6" | "7-10" | "11-14";

export const AGE_BANDS: readonly AgeBand[] = ["4-6", "7-10", "11-14"];

export const MAX_CHILD_PROFILES_PER_ACCOUNT = 5;

/** 12 preset, animal-themed avatars — no photo upload (docs/kids-mode/04-safety-privacy-content.md §3). */
export const AVATAR_IDS: readonly string[] = Array.from({ length: 12 }, (_, i) => `animal-${i + 1}`);

export interface ChildProfile {
  id: string;
  parentUserId: string;
  childIndex: number;
  displayName: string;
  ageBand: AgeBand;
  avatarId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildProfileInput {
  displayName: string;
  ageBand: AgeBand;
  avatarId?: string;
}

export interface UpdateChildProfileInput {
  displayName?: string;
  ageBand?: AgeBand;
  avatarId?: string;
}

/** Row shape as it comes back from Supabase (snake_case), before mapping to ChildProfile. */
export interface ChildProfileRow {
  id: string;
  parent_user_id: string;
  child_index: number;
  display_name: string;
  age_band: AgeBand;
  avatar_id: string;
  created_at: string;
  updated_at: string;
}

export function mapChildProfileRow(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    parentUserId: row.parent_user_id,
    childIndex: row.child_index,
    displayName: row.display_name,
    ageBand: row.age_band,
    avatarId: row.avatar_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Validate a display name. Returns an error string, or null if valid.
 * Pure — no I/O — so it can be unit tested and reused client-side for
 * instant feedback without duplicating the rule.
 */
export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Enter a name.";
  if (trimmed.length > 30) return "That name is a bit long — 30 characters or fewer.";
  return null;
}

export function validateAgeBand(ageBand: string): ageBand is AgeBand {
  return (AGE_BANDS as readonly string[]).includes(ageBand);
}

export function validateAvatarId(avatarId: string): boolean {
  return (AVATAR_IDS as readonly string[]).includes(avatarId);
}
