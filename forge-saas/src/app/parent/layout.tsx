import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasKidsModeAccess } from "@/lib/entitlements";

/**
 * The real security boundary for every /parent route: signed in, and both
 * Kids Mode layers open for this account (docs/kids-mode/00-principles.md P9).
 * The PIN gate in (dashboard)/layout.tsx is a UX layer on top of this, never
 * a replacement for it (P2).
 *
 * Flag closed → notFound(), not a redirect. A redirect to somewhere would
 * still confirm the route exists; 404 does not
 * (docs/kids-mode/03-architecture-and-data.md §2).
 */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
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

  return <>{children}</>;
}
