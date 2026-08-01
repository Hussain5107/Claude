"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  exportTrainingData,
  reviewAiSuggestions,
  swapExercise,
  type ReviewedSuggestion,
} from "@/app/dashboard/actions";
import { Button, Card } from "./ui";

/**
 * Bridges FORGE to whichever AI assistant the user already has.
 *
 * FORGE has no AI of its own and no API budget, so instead of a chatbot this
 * exports the training history as a self-describing file, and reads structured
 * swap suggestions back out of the reply.
 *
 * Suggestions are never applied automatically. Pasted text is untrusted — every
 * swap is re-validated against the user's real plan and equipment server-side,
 * and then applied one at a time only when the user taps approve.
 */
export default function AiCoachPanel() {
  const router = useRouter();

  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [pasted, setPasted] = useState("");
  const [checking, setChecking] = useState(false);
  const [reviewed, setReviewed] = useState<ReviewedSuggestion[] | null>(null);
  const [rejected, setRejected] = useState<{ text: string; reason: string }[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function getMarkdown(): Promise<string | null> {
    setExportError(null);
    const result = await exportTrainingData();
    if (result.error) {
      setExportError(result.error);
      return null;
    }
    return result.markdown;
  }

  async function handleCopy() {
    setExporting(true);
    const markdown = await getMarkdown();
    setExporting(false);
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setExportError("Couldn't copy automatically — use Download instead.");
    }
  }

  async function handleDownload() {
    setExporting(true);
    const markdown = await getMarkdown();
    setExporting(false);
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `forge-training-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCheck() {
    setChecking(true);
    setReviewError(null);
    const result = await reviewAiSuggestions(pasted);
    setChecking(false);
    if (result.error) {
      setReviewError(result.error);
      return;
    }
    setReviewed(result.usable);
    setRejected(result.rejected);
  }

  async function apply(suggestion: ReviewedSuggestion) {
    const key = `${suggestion.dayNumber}:${suggestion.fromSlug}`;
    setApplying(key);
    const result = await swapExercise(
      suggestion.dayNumber,
      suggestion.fromSlug,
      suggestion.toSlug,
    );
    setApplying(null);
    if (result.error) {
      setReviewError(result.error);
      return;
    }
    setApplied((prev) => new Set(prev).add(key));
    router.refresh();
  }

  return (
    <Card className="mt-8 p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-faint)]">
        Get advice from an AI
      </h2>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        FORGE doesn&apos;t have its own AI coach. Instead you can hand your training history to one
        you already use — ChatGPT, Claude, Gemini — and bring its suggestions back here.
      </p>

      <ol className="mt-4 flex flex-col gap-2 text-sm text-[var(--text-dim)]">
        <li>
          <b className="text-[var(--text)]">1.</b> Copy your training history below.
        </li>
        <li>
          <b className="text-[var(--text)]">2.</b> Paste it into any AI assistant — it comes with
          instructions attached, so you don&apos;t need to write a prompt.
        </li>
        <li>
          <b className="text-[var(--text)]">3.</b> Paste its reply back here, and approve any
          changes you like.
        </li>
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={handleCopy} disabled={exporting} className="px-4 py-2 text-xs">
          {exporting ? "Preparing…" : copied ? "Copied ✓" : "Copy my training history"}
        </Button>
        <Button onClick={handleDownload} disabled={exporting} className="px-4 py-2 text-xs">
          Download as file
        </Button>
      </div>
      {exportError && <p className="mt-2 text-sm text-[var(--rose)]">{exportError}</p>}

      <div className="mt-6">
        <label htmlFor="aiReply" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
          Paste the AI&apos;s reply
        </label>
        <textarea
          id="aiReply"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder="Paste the whole reply here — anything it suggests that fits your equipment will show up below."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-3 text-sm outline-none focus:border-[var(--secondary)]"
        />
        <Button
          onClick={handleCheck}
          disabled={checking || pasted.trim().length === 0}
          className="mt-2 px-4 py-2 text-xs"
        >
          {checking ? "Checking…" : "Check its suggestions"}
        </Button>
      </div>

      {reviewError && <p className="mt-3 text-sm text-[var(--rose)]">{reviewError}</p>}

      {reviewed !== null && (
        <div className="mt-5">
          {reviewed.length === 0 && rejected.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">
              No specific exercise swaps found in that reply. Any general advice it gave is still
              worth reading — this only picks up concrete swaps it suggested.
            </p>
          )}

          {reviewed.length > 0 && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Suggested changes
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {reviewed.map((s) => {
                  const key = `${s.dayNumber}:${s.fromSlug}`;
                  const isApplied = applied.has(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
                          {s.dayName}
                        </div>
                        <div className="text-sm">
                          <span className="text-[var(--text-faint)] line-through">{s.fromName}</span>{" "}
                          <span className="text-[var(--text-dim)]">→</span>{" "}
                          <span className="font-bold">{s.toName}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-faint)]">{s.toEquip}</div>
                      </div>
                      <Button
                        variant={isApplied ? "default" : "primary"}
                        disabled={isApplied || applying === key}
                        onClick={() => apply(s)}
                        className="shrink-0 px-3 py-1.5 text-xs"
                      >
                        {isApplied ? "Applied ✓" : applying === key ? "Applying…" : "Apply"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {rejected.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Couldn&apos;t apply
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {rejected.map((r, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border)] px-3 py-2">
                    <div className="text-sm text-[var(--text-dim)]">{r.text}</div>
                    <div className="text-[11px] text-[var(--amber)]">{r.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 text-[11px] text-[var(--text-faint)]">
        Your export contains your training numbers and profile, but no email or password. Anything
        an AI suggests is checked against your own plan and equipment before it&apos;s offered here,
        and nothing changes until you tap Apply.
      </p>
    </Card>
  );
}
