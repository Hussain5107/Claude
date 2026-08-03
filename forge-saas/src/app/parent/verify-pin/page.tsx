"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";
import { verifyPinAction } from "./actions";

export default function VerifyPinPage() {
  return (
    <Suspense fallback={null}>
      <VerifyPinForm />
    </Suspense>
  );
}

function VerifyPinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/parent";

  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await verifyPinAction(pin);
    setPending(false);
    if (result.error) {
      setError(result.error);
      setPin("");
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm items-center p-4">
      <Card className="w-full space-y-4 p-6">
        <div>
          <h1 className="text-lg font-extrabold text-[var(--text)]">Enter your PIN</h1>
          <p className="text-sm text-[var(--text-dim)]">Quick check before parent settings.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
              required
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" disabled={pending} className="w-full justify-center">
            {pending ? "Checking…" : "Continue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
