"use client";

import { useActionState, useState } from "react";
import { submitOnboarding, type OnboardingState } from "./actions";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { Logo } from "@/components/Logo";
import ThemePicker from "@/components/ThemePicker";
import { suggestedTheme, type ThemeName } from "@/lib/theme";
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_DURATION } from "@/lib/cycle";

const initialState: OnboardingState = {};

const DAY_CHOICES = [
  { days: 3, label: "Full body", detail: "Three full-body sessions, a rest day between each." },
  { days: 4, label: "Upper / Lower", detail: "Upper and lower body, each trained twice a week." },
  { days: 5, label: "PPL + U/L", detail: "Push, pull and legs, plus an upper and a lower day." },
  { days: 6, label: "PPL ×2", detail: "Push, pull and legs, each trained twice a week." },
];

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(submitOnboarding, initialState);
  const [trainingLocation, setTrainingLocation] = useState<"gym" | "home">("gym");
  const [hasDumbbells, setHasDumbbells] = useState<"yes" | "no">("yes");
  const [daysPerWeek, setDaysPerWeek] = useState(6);

  // The theme follows the sex answer until the user picks one themselves —
  // then it stops following, so their choice isn't overwritten if they go back
  // and change the dropdown.
  const [theme, setTheme] = useState<ThemeName>("forge");
  const [themePicked, setThemePicked] = useState(false);

  // Cycle tracking is offered to female users only, and is entirely optional —
  // "not now" is a first-class answer and everything below can be filled in
  // later from Settings instead.
  const [sex, setSex] = useState("");
  const [cycleTracking, setCycleTracking] = useState(false);

  function handleSexChange(next: string) {
    setSex(next);
    if (next !== "female") setCycleTracking(false);
    if (!themePicked) setTheme(suggestedTheme(next));
  }

  function handleThemeChange(next: ThemeName) {
    setThemePicked(true);
    setTheme(next);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mb-2 flex justify-center">
          <Logo className="text-xl" />
        </div>
        <h1 className="text-2xl font-extrabold">Let&apos;s build your program</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">
          A few quick questions, then your personalized plan is ready.
        </p>
      </div>

      <Card className="p-6">
        <form action={formAction} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" name="age" type="number" min={13} max={100} required placeholder="28" />
            </div>
            <div>
              <Label htmlFor="sex">Sex</Label>
              <Select
                id="sex"
                name="sex"
                required
                defaultValue=""
                onChange={(e) => handleSexChange(e.target.value)}
              >
                <option value="" disabled>
                  Select…
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="heightCm">Height (cm)</Label>
              <Input id="heightCm" name="heightCm" type="number" min={100} max={250} required placeholder="175" />
            </div>
            <div>
              <Label htmlFor="weightKg">Weight (kg)</Label>
              <Input id="weightKg" name="weightKg" type="number" min={30} max={300} step="0.1" required placeholder="72" />
            </div>
          </div>

          <div>
            <Label htmlFor="goal">Primary goal</Label>
            <Select id="goal" name="goal" required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              <option value="muscle">Build muscle (hypertrophy)</option>
              <option value="strength">Get stronger</option>
              <option value="fat_loss">Lose fat</option>
              <option value="general_fitness">General fitness</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="experience">Training experience</Label>
            <Select id="experience" name="experience" required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              <option value="beginner">Beginner (0–6 months)</option>
              <option value="intermediate">Intermediate (6 months–2 years)</option>
              <option value="advanced">Advanced (2+ years)</option>
            </Select>
          </div>

          <div>
            <Label>Where will you train?</Label>
            <input type="hidden" name="trainingLocation" value={trainingLocation} />
            <div className="grid grid-cols-2 gap-3">
              <LocationOption
                label="🏋️ Gym"
                active={trainingLocation === "gym"}
                onClick={() => setTrainingLocation("gym")}
              />
              <LocationOption
                label="🏠 Home"
                active={trainingLocation === "home"}
                onClick={() => setTrainingLocation("home")}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-faint)]">
              You can change this any time from Settings.
            </p>
          </div>

          {trainingLocation === "home" && (
            <div>
              <Label>Do you have dumbbells at home?</Label>
              <input type="hidden" name="hasDumbbells" value={hasDumbbells} />
              <div className="grid grid-cols-2 gap-3">
                <LocationOption label="Yes" active={hasDumbbells === "yes"} onClick={() => setHasDumbbells("yes")} />
                <LocationOption label="No" active={hasDumbbells === "no"} onClick={() => setHasDumbbells("no")} />
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                No dumbbells is perfect for a park or bodyweight-only session too.
              </p>
            </div>
          )}

          <div>
            <Label>How many days a week can you train?</Label>
            <input type="hidden" name="daysPerWeek" value={daysPerWeek} />
            <div className="grid grid-cols-4 gap-2">
              {DAY_CHOICES.map((c) => (
                <button
                  key={c.days}
                  type="button"
                  onClick={() => setDaysPerWeek(c.days)}
                  className={`rounded-xl border px-2 py-2.5 text-center transition ${
                    daysPerWeek === c.days
                      ? "border-transparent bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--border-hi)]"
                  }`}
                >
                  <span className="block text-base font-extrabold">{c.days}</span>
                  <span className="block text-[10px] font-semibold leading-tight opacity-80">
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-faint)]">
              {DAY_CHOICES.find((c) => c.days === daysPerWeek)?.detail}
            </p>
          </div>

          {sex === "female" && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <Label>Would you like FORGE to adapt your workouts to your cycle?</Label>
              <input type="hidden" name="cycleTracking" value={cycleTracking ? "yes" : "no"} />
              <div className="grid grid-cols-2 gap-3">
                <LocationOption
                  label="Yes, adapt them"
                  active={cycleTracking}
                  onClick={() => setCycleTracking(true)}
                />
                <LocationOption
                  label="No, keep it standard"
                  active={!cycleTracking}
                  onClick={() => setCycleTracking(false)}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--text-faint)]">
                It suggests how heavy to go based on where you are in your cycle, and lets you log
                how you feel each day. It never takes a session away. Private to you, and you can
                turn it on or off any time.
              </p>

              {cycleTracking && (
                <div className="mt-4 flex flex-col gap-4">
                  <div>
                    <Label htmlFor="lastPeriodStart">First day of your last period</Label>
                    <Input
                      id="lastPeriodStart"
                      name="lastPeriodStart"
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                    />
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      You can skip this and add it later — nothing is calculated until it&apos;s set.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cycleLength">Cycle length (days)</Label>
                      <Input
                        id="cycleLength"
                        name="cycleLength"
                        type="number"
                        min={20}
                        max={45}
                        defaultValue={DEFAULT_CYCLE_LENGTH}
                      />
                    </div>
                    <div>
                      <Label htmlFor="periodDuration">Period length (days)</Label>
                      <Input
                        id="periodDuration"
                        name="periodDuration"
                        type="number"
                        min={1}
                        max={10}
                        defaultValue={DEFAULT_PERIOD_DURATION}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Your look</Label>
            <input type="hidden" name="theme" value={theme} />
            <ThemePicker value={theme} onChange={handleThemeChange} />
            <p className="mt-1.5 text-xs text-[var(--text-faint)]">
              Colours only — your program and your numbers are the same whichever you pick. You can
              change it any time from Settings.
            </p>
          </div>

          <ErrorText>{state?.error}</ErrorText>

          <Button type="submit" variant="primary" disabled={pending} className="mt-2 w-full">
            {pending ? "Building your program…" : "Generate my program"}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-center text-xs text-[var(--text-faint)]">
        Your equipment and training days decide which exercises you get; your goal and experience
        tune the sets, reps, rest and nutrition targets on top of that.
      </p>
    </main>
  );
}

function LocationOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-transparent bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] text-white"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--border-hi)]"
      }`}
    >
      {label}
    </button>
  );
}
