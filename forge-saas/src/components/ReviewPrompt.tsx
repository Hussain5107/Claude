"use client";

import { useEffect, useState } from "react";
import { submitReview } from "@/app/dashboard/actions";
import { Button, Card } from "./ui";

const DISMISS_KEY = "forge:reviewLastDismissed";

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 86_400_000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReviewPrompt({
  accountCreatedAt,
  alreadyReviewed,
}: {
  accountCreatedAt: string;
  alreadyReviewed: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [isReturningPrompt, setIsReturningPrompt] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (alreadyReviewed) return;
    if (daysSince(accountCreatedAt) < 3) return;

    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    if (lastDismissed === todayIso()) return; // already dismissed today, wait until tomorrow

    setIsReturningPrompt(!!lastDismissed);
    setVisible(true);
  }, [accountCreatedAt, alreadyReviewed]);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, todayIso());
    setVisible(false);
  }

  async function handleSubmit() {
    if (rating === 0) return;
    setSubmitting(true);
    const result = await submitReview(rating, comment);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    setTimeout(() => setVisible(false), 1800);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <Card className="w-full max-w-sm p-6">
        {submitted ? (
          <div className="py-4 text-center">
            <div className="mb-2 text-3xl">🙌</div>
            <p className="font-bold">Thanks for the feedback!</p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold">
              {isReturningPrompt ? "Got a quick minute?" : "How's FORGE working for you?"}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              {isReturningPrompt
                ? "Your honest take helps us build something worth training with. Just 10 seconds."
                : "You've been training for a few days now — tell us how it's going."}
            </p>

            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="text-3xl transition hover:scale-110"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                >
                  {n <= rating ? "⭐" : "☆"}
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything you'd change? (optional)"
              rows={3}
              className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2.5 text-sm outline-none focus:border-[var(--secondary)]"
            />

            <div className="mt-4 flex gap-2">
              <Button onClick={handleDismiss} className="flex-1">
                Maybe later
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="flex-1"
              >
                {submitting ? "Sending…" : "Submit"}
              </Button>
            </div>
            {error && <p className="mt-3 text-sm text-[var(--rose)]">Couldn&apos;t submit: {error}</p>}
          </>
        )}
      </Card>
    </div>
  );
}
