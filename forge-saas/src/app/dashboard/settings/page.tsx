import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/SettingsClient";
import { isEligible, loadCycleContext } from "@/lib/cycleServer";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/onboarding");

  const { data: recentMetrics } = await supabase
    .from("health_metrics")
    .select("*")
    .eq("user_id", user.id)
    .order("log_date", { ascending: false })
    .limit(10);

  const cycleEligible = isEligible(profile.sex, profile.plan);
  const cycle = cycleEligible
    ? await loadCycleContext(supabase, user.id, new Date().toISOString().slice(0, 10))
    : null;

  return (
    <SettingsClient
      profile={profile}
      recentMetrics={recentMetrics ?? []}
      cycle={cycle ? { eligible: true, ...cycle.settings } : null}
    />
  );
}
