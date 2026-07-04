export function SiteHeader() {
  return (
    <header className="w-full border-b border-[var(--border-hairline)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4">
          {/* Wordmark — wide-tracked navy (BRAND). Replace with official SVG. */}
          <span
            className="font-[var(--font-display)] text-lg font-semibold text-[var(--eigan-navy)]"
            style={{ letterSpacing: "0.18em" }}
          >
            EIGAN
          </span>
          <span className="h-4 w-px bg-[var(--border)]" />
          <span className="label-system">Spectre CIA</span>
        </div>
        <span className="hidden font-[var(--font-mono)] text-xs text-muted-foreground sm:inline">
          a sensor, not a guardrail
        </span>
      </div>
    </header>
  );
}
