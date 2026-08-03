import { createClient } from "@/lib/supabase/server";
import { listChildProfiles } from "@/lib/kids/kidsServer";
import { hasPinSetup } from "@/lib/kids/pin";
import ParentDashboardClient from "./ParentDashboardClient";

export default async function ParentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The layouts above this page already guarantee `user` is set — this is
  // just satisfying TypeScript, not a real auth check (that already happened).
  if (!user) return null;

  const [children, pinIsSetUp] = await Promise.all([
    listChildProfiles(supabase, user.id),
    hasPinSetup(supabase, user.id),
  ]);

  return <ParentDashboardClient initialChildren={children} pinIsSetUp={pinIsSetUp} />;
}
