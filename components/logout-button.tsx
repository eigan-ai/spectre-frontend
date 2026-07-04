"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="font-[var(--font-mono)] text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      {busy ? "…" : "Log out"}
    </button>
  );
}
