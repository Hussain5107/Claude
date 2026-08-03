import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasKidsModeAccess } from "@/lib/entitlements";
import { resolveChildByIndex } from "@/lib/kids/kidsServer";
// Imported here, not in the root layout, so this CSS is only ever bundled for
// /kids routes — see the file's own header comment and 03 §8.
import "@/styles/kids-tokens.css";

/**
 * Request path for every /kids/[child]/* route
 * (docs/kids-mode/03-architecture-and-data.md §2):
 *   1. getUser()             — no user? /login (middleware already does this
 *                               too, since /kids isn't in PUBLIC_PATHS; this
 *                               re-check is the "never trust the layout" rule
 *                               applied one level up, to the layout itself).
 *   2. hasKidsModeAccess()    — flag closed? 404, not a redirect.
 *   3. resolveChildByIndex()  — not this parent's child? 404, not a redirect
 *                               (a 403 would confirm the child exists).
 *
 * [child] is a small per-parent index (1-5), not the row's uuid — chosen so a
 * shared-phone browser history or screenshot doesn't carry a stable child
 * identifier. See the Phase 1 migration and docs/kids-mode/03-architecture-and-data.md §3.
 */
export default async function KidsChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ child: string }>;
}) {
  const { child } = await params;
  const childIndex = Number(child);

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
    notFound();
  }

  const childProfile = await resolveChildByIndex(supabase, user.id, childIndex);
  if (!childProfile) {
    notFound();
  }

  return (
    <div data-mode="kids" className="kids-shell min-h-screen">
      {children}
    </div>
  );
}
