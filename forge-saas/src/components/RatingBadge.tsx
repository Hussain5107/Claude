import { createClient } from "@supabase/supabase-js";

/**
 * Overall rating from real user reviews, for the landing page.
 *
 * Renders nothing until there are enough reviews for an average to mean
 * anything. Showing "5.0" off the back of one or two ratings would overstate
 * how settled the score is to someone deciding whether to sign up — and since
 * the count isn't displayed, a visitor has no way to judge that for themselves.
 *
 * Uses a plain anon client rather than the cookie-reading server client: this
 * is public data, and touching cookies would force the whole landing page to
 * render per-request instead of being cached.
 */
const MIN_REVIEWS = 5;

export default async function RatingBadge() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data } = await supabase
    .from("review_stats")
    .select("review_count, average_rating")
    .maybeSingle();

  const count = data?.review_count ?? 0;
  const average = data?.average_rating ?? 0;
  if (count < MIN_REVIEWS || !average) return null;

  const rounded = Math.round(average);

  return (
    <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2">
      <span className="text-sm tracking-tight text-[var(--amber)]" aria-hidden="true">
        {"★".repeat(rounded)}
        <span className="text-[var(--text-faint)]">{"★".repeat(5 - rounded)}</span>
      </span>
      <span className="font-mono text-sm font-bold text-[var(--text)]">
        {average.toFixed(1)}
      </span>
      <span className="text-xs text-[var(--text-dim)]">rated by people using FORGE</span>
    </div>
  );
}
