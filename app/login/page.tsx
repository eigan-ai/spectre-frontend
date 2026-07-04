"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed.");
      } else {
        // Full navigation so middleware re-evaluates with the new cookie.
        router.replace(from);
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-8">
      <div className="label-system mb-3">Spectre CIA · Access</div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Sign in
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        This preview is limited to authorized users. Your email is used only to
        track access.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label-system">Email</span>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-system">Password</span>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={busy}
          />
        </label>

        {error && (
          <p className="text-sm text-[var(--signal-enforced)]">{error}</p>
        )}

        <Button type="submit" size="lg" disabled={busy} className="mt-2">
          {busy ? "Signing in…" : "Enter"}
          {!busy && <ArrowRight className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
