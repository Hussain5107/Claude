"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 flex justify-center">
        <Logo className="text-xl" />
      </Link>

      <Card className="p-6">
        <h1 className="mb-1 text-lg font-bold">Welcome back</h1>
        <p className="mb-5 text-sm text-[var(--text-dim)]">Log in to your program.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" disabled={loading} className="mt-2 w-full">
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-center text-sm text-[var(--text-dim)]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[var(--secondary)]">
          Sign up
        </Link>
      </p>
    </main>
  );
}
