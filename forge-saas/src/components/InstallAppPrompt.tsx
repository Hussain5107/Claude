"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "./ui";

const SEEN_KEY = "forge:installPromptSeen";

type Platform = "iphone" | "android" | null;

const STEPS: Record<Exclude<Platform, null>, { title: string; steps: string[] }> = {
  iphone: {
    title: "Add FORGE to your Home Screen",
    steps: [
      "Open this site in Safari (not another browser — iOS only supports this from Safari).",
      "Tap the Share button (the square with an arrow up), in the bottom toolbar.",
      "Scroll down and tap \"Add to Home Screen.\"",
      "Tap \"Add\" in the top right.",
    ],
  },
  android: {
    title: "Add FORGE to your Home Screen",
    steps: [
      "Open this site in Chrome.",
      "Tap the ⋮ menu icon in the top right.",
      "Tap \"Install app\" or \"Add to Home screen.\"",
      "Confirm by tapping \"Install\" or \"Add.\"",
    ],
  },
};

export default function InstallAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(SEEN_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <Card className="w-full max-w-sm p-6">
        {!platform ? (
          <>
            <div className="mb-2 text-3xl">📲</div>
            <h3 className="text-lg font-bold">Install FORGE as an app</h3>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Add it to your home screen for one-tap access, full-screen workouts, and no browser bar in the way.
            </p>
            <div className="mt-5 flex gap-2">
              <Button className="flex-1" onClick={() => setPlatform("iphone")}>
                📱 iPhone
              </Button>
              <Button className="flex-1" onClick={() => setPlatform("android")}>
                🤖 Android
              </Button>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="mt-4 w-full text-center text-xs text-[var(--text-faint)] hover:text-[var(--text)]"
            >
              Maybe later
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold">{STEPS[platform].title}</h3>
            <ol className="mt-4 flex flex-col gap-3">
              {STEPS[platform].steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-[var(--text-dim)]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <Button variant="primary" onClick={dismiss} className="mt-5 w-full">
              Got it
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
