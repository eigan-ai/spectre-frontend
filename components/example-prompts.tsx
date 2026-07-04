"use client";

import { EXAMPLES, type ExamplePrompt } from "@/lib/spectre";

export function ExamplePrompts({
  onPick,
  disabled,
}: {
  onPick: (e: ExamplePrompt) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-system">Try an example</span>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(e)}
            title={e.hint}
            className="group flex flex-col items-start gap-0.5 rounded-[2px] border border-[var(--border)] bg-transparent px-3 py-2 text-left transition-colors hover:border-[var(--eigan-cyan)] hover:bg-secondary disabled:opacity-50"
          >
            <span className="font-[var(--font-mono)] text-xs uppercase tracking-wide text-foreground">
              {e.label}
            </span>
            <span className="text-[0.6875rem] text-muted-foreground">
              {e.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
