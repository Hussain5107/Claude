import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveChildByIndex } from "@/lib/kids/kidsServer";
import { avatarEmoji } from "@/lib/kids/avatars";
import KidsExitLink from "@/components/kids/KidsExitLink";

/**
 * Phase 1 stub. The real home screen — Today's Mission, categories, streak —
 * is Phase 2 (docs/kids-mode/05-delivery-roadmap.md). This page exists to
 * prove the request path (auth → flag → ownership → render) end to end
 * before any child-facing content is built on top of it.
 */
export default async function KidsChildHomePage({ params }: { params: Promise<{ child: string }> }) {
  const { child } = await params;
  const childIndex = Number(child);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const childProfile = await resolveChildByIndex(supabase, user.id, childIndex);
  if (!childProfile) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--kids-bg-secondary)] text-5xl">
        {avatarEmoji(childProfile.avatarId)}
      </span>
      <h1 className="text-2xl font-extrabold text-[var(--kids-text-primary)]">Hi, {childProfile.displayName}!</h1>
      <p className="max-w-xs text-sm text-[var(--kids-text-secondary)]">
        Kids Mode is still being built. Missions, badges, and workouts are coming soon.
      </p>
      <KidsExitLink />
    </main>
  );
}
