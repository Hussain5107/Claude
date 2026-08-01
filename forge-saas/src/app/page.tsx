import Link from "next/link";
import Image from "next/image";
import { Button, Card } from "@/components/ui";
import LandingNav from "@/components/landing/LandingNav";
import Reveal from "@/components/landing/Reveal";
import DashboardPreview from "@/components/landing/DashboardPreview";
import { Logo } from "@/components/Logo";
import RatingBadge from "@/components/RatingBadge";

// Public marketing page — regenerate hourly rather than querying per visit.
export const revalidate = 3600;

const STATS = [
  { value: "6", label: "Day PPL program" },
  { value: "43", label: "Real exercise photos" },
  { value: "4", label: "Goals supported" },
  { value: "<60s", label: "To build your plan" },
];

const FEATURES = [
  {
    icon: "🎯",
    image: "/hero/coached-overhead-press.jpg",
    title: "Personalized to you",
    body: "Age, sex, height, weight, goal, and experience level tune your sets, reps, rest, and nutrition targets.",
  },
  {
    icon: "📷",
    image: "/hero/deadlift-closeup.jpg",
    title: "Real exercise photos",
    body: "Every exercise has a real reference photo and a proper-form video, not a generic icon.",
  },
  {
    icon: "🍽️",
    image: "/hero/goblet-squat.jpg",
    title: "Nutrition dialed in",
    body: "Daily calorie, protein, and water targets computed from your numbers and your goal.",
  },
  {
    icon: "📈",
    image: "/hero/trx-pair.jpg",
    title: "Track every session",
    body: "Log sets, catch new personal records automatically, and build a streak — synced to your account.",
  },
];

const GOALS = [
  { image: "/hero/goblet-squat.jpg", title: "Build muscle", body: "Higher volume, hypertrophy-focused rep ranges." },
  { image: "/hero/deadlift-closeup.jpg", title: "Get stronger", body: "Heavier loads, longer rest, strength-first prescriptions." },
  { image: "/hero/trx-pair.jpg", title: "Lose fat", body: "Trimmed rest periods to keep density and intensity up." },
  { image: "/hero/coached-overhead-press.jpg", title: "General fitness", body: "Balanced, sustainable volume for long-term consistency." },
];

const STEPS = [
  { n: "01", title: "Create your account", body: "Just an email — no card required during the free beta." },
  { n: "02", title: "Answer a few questions", body: "Age, sex, height, weight, goal, and experience level." },
  { n: "03", title: "Get your 6-day program", body: "A real Push/Pull/Legs split, personalized to your numbers." },
  { n: "04", title: "Train and log sets", body: "Real photos, form cues, and a voice coach that talks you through it." },
  { n: "05", title: "Track your progress", body: "1RM trends, personal records, and streaks, all in one place." },
];

const TRUST_POINTS = [
  { icon: "🆓", title: "Free during beta", body: "No credit card, no trial countdown. Every feature on this page, free." },
  { icon: "🔒", title: "Your data stays yours", body: "Your program, logs, and progress are tied to your account — not sold, not shared." },
  { icon: "🧠", title: "Rules-based, not guesswork", body: "Sets, reps, rest, and nutrition targets come from an explicit, explainable formula — not a black box." },
  { icon: "🎙️", title: "Zero-cost voice coach", body: "Built on your browser's built-in speech APIs, not a paid AI subscription." },
];

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-10">
        {/* Hero */}
        <section className="grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div className="text-center lg:text-left">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--volt)]" />
              Free during beta
            </div>
            <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl lg:mx-0 lg:text-6xl">
              Your personalized{" "}
              <span className="bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
                6-day program
              </span>
              , built in a minute.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[var(--text-dim)] lg:mx-0">
              Answer a few questions about yourself and your goal. Get a real Push/Pull/Legs program
              with photos, videos, and nutrition targets — not a generic PDF.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/signup">
                <Button variant="primary" className="px-7 py-3 text-base">
                  Build my program
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button className="px-7 py-3 text-base">See how it works</Button>
              </a>
            </div>

            <RatingBadge />
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <Image
              src="/hero/training-partners-2.jpg"
              alt="Training with intensity"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)]/70 via-transparent to-transparent" />
          </div>
        </section>

        {/* Stats */}
        <Reveal>
          <section className="grid grid-cols-2 gap-4 border-y border-[var(--border)] py-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-[family-name:var(--font-display)] text-3xl font-extrabold sm:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-[var(--text-faint)]">{s.label}</div>
              </div>
            ))}
          </section>
        </Reveal>

        {/* Features */}
        <section id="features" className="py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Everything you need to train</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[var(--text-dim)]">
              No generic PDFs, no guesswork — a program built around your numbers, with the detail to back it up.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <Card className="group overflow-hidden p-0 transition hover:-translate-y-1 hover:border-[var(--border-hi)]">
                  <div className="relative h-36 w-full overflow-hidden">
                    <Image
                      src={f.image}
                      alt=""
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-[var(--surface)]/10 to-transparent" />
                    <span className="absolute bottom-2 left-3 text-2xl">{f.icon}</span>
                  </div>
                  <div className="p-5 pt-3">
                    <h3 className="mb-1 font-bold">{f.title}</h3>
                    <p className="text-sm text-[var(--text-dim)]">{f.body}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Goals */}
        <section className="py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Built around your goal</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[var(--text-dim)]">
              Same proven Push/Pull/Legs split for everyone — sets, reps, and rest are tuned to what you're
              actually training for.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {GOALS.map((g, i) => (
              <Reveal key={g.title} delay={i * 80}>
                <div className="group relative aspect-[3/4] overflow-hidden rounded-[18px] border border-[var(--border)]">
                  <Image
                    src={g.image}
                    alt=""
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="font-bold text-white">{g.title}</h3>
                    <p className="mt-1 text-xs text-white/70">{g.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold sm:text-4xl">How it works</h2>
          </Reveal>
          <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 70}>
                <div className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] font-mono text-sm font-bold text-white">
                      {s.n}
                    </span>
                    {i < STEPS.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-[var(--border)]" />}
                  </div>
                  <div className="pb-6">
                    <h3 className="font-bold">{s.title}</h3>
                    <p className="mt-1 text-sm text-[var(--text-dim)]">{s.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Progress preview */}
        <section className="py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold sm:text-4xl">See your progress add up</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[var(--text-dim)]">
              Every set you log feeds your 1RM trend, your personal records, and your streak.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="mx-auto mt-10 max-w-xl">
              <DashboardPreview />
            </div>
          </Reveal>
        </section>

        {/* Trust signals (no fabricated testimonials) */}
        <section className="py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Built to be trusted, not hyped</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TRUST_POINTS.map((t, i) => (
              <Reveal key={t.title} delay={i * 80}>
                <Card className="p-5">
                  <div className="mb-2 text-2xl">{t.icon}</div>
                  <h3 className="mb-1 font-bold">{t.title}</h3>
                  <p className="text-sm text-[var(--text-dim)]">{t.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <Reveal>
          <section className="relative overflow-hidden rounded-[24px] border border-[var(--border)] px-6 py-16 text-center sm:py-20">
            <Image src="/hero/deadlift-closeup.jpg" alt="" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/85 to-[var(--bg)]/40" />
            <div className="relative">
              <h2 className="mx-auto max-w-lg text-3xl font-extrabold sm:text-4xl">
                Start your program today.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[var(--text-dim)]">
                Free during beta. Built in a minute. No generic PDF in sight.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <Link href="/signup">
                  <Button variant="primary" className="px-7 py-3 text-base">
                    Build my program
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button className="px-7 py-3 text-base">View pricing</Button>
                </Link>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Footer */}
        <footer className="mt-16 flex flex-col items-center gap-4 border-t border-[var(--border)] py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <Logo />
          <nav className="flex gap-6 text-sm text-[var(--text-dim)]">
            <Link href="/pricing" className="hover:text-[var(--text)]">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-[var(--text)]">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-[var(--text)]">
              Get started
            </Link>
          </nav>
          <div className="text-xs text-[var(--text-faint)]">
            &copy; {new Date().getFullYear()} FORGE. Built for people who train.
          </div>
        </footer>
      </main>
    </>
  );
}
