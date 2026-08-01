import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { cycleStatus } from "@/lib/cycle";
import { adaptForCycle } from "@/lib/cycleAdaptation";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const currentHour = new Date().getUTCHours();
  const supabase = createServiceClient();

  const { data: waterUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("water_reminder_enabled", true)
    .eq("water_reminder_hour", currentHour);

  const { data: workoutUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("workout_reminder_enabled", true)
    .eq("workout_reminder_hour", currentHour);

  // The workout reminder gets a cycle-aware line for users who opted in, so
  // they don't have to open the app to know what today is likely to feel like.
  // Supportive, never medical, and never telling anyone to skip training.
  const workoutIds = (workoutUsers ?? []).map((u) => u.id);
  const cycleBodyByUser = new Map<string, string>();

  if (workoutIds.length > 0) {
    const { data: cycleRows } = await supabase
      .from("cycle_settings")
      .select("user_id, enabled, last_period_start, average_cycle_length, period_duration")
      .eq("enabled", true)
      .in("user_id", workoutIds);

    for (const row of cycleRows ?? []) {
      const status = cycleStatus({
        enabled: row.enabled,
        lastPeriodStart: row.last_period_start,
        averageCycleLength: row.average_cycle_length,
        periodDuration: row.period_duration,
      });
      // Skip anyone whose start date has drifted — a wrong phase in a push
      // notification is worse than no phase at all.
      if (!status || status.stale) continue;
      cycleBodyByUser.set(row.user_id, adaptForCycle(status.phase, null).headline);
    }
  }

  const jobs: { userId: string; title: string; body: string }[] = [
    ...(waterUsers ?? []).map((u) => ({
      userId: u.id,
      title: "💧 Hydration check",
      body: "Time for some water — your body needs it to recover and train well.",
    })),
    ...(workoutUsers ?? []).map((u) => {
      const cycleLine = cycleBodyByUser.get(u.id);
      return {
        userId: u.id,
        title: "🏋️ Workout reminder",
        body: cycleLine
          ? `${cycleLine}. Today's session is ready on FORGE.`
          : "Today's session is waiting for you on FORGE.",
      };
    }),
  ];

  let sent = 0;
  let removed = 0;

  for (const job of jobs) {
    const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", job.userId);
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify({ title: job.title, body: job.body, url: "/dashboard" }),
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        }
      }
    }
  }

  return NextResponse.json({ hour: currentHour, jobs: jobs.length, sent, removed });
}
