import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasPinSetup, isPinSessionValid, PIN_SESSION_COOKIE_NAME } from "@/lib/kids/pin";

/**
 * UX gate only (docs/kids-mode/00-principles.md P2) — the real auth + flag
 * check already happened in the parent layout above this one. If the account
 * hasn't set up a PIN yet, there's nothing to gate on, so this lets them
 * straight through to set one up (or skip it).
 */
export default async function ParentDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (await hasPinSetup(supabase, user.id)) {
    const cookieStore = await cookies();
    const token = cookieStore.get(PIN_SESSION_COOKIE_NAME)?.value;
    if (!(await isPinSessionValid(token, user.id))) {
      redirect("/parent/verify-pin");
    }
  }

  return <>{children}</>;
}
