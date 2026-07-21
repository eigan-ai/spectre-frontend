"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Progress } from "@/components/ui/progress";

// ZeroGPU gives us no fine-grained progress, so we narrate the expected
// lifecycle on a timeline. Stages advance on timers and HOLD at the last one
// until the real response arrives — honest about "still working", never
// claiming completion we can't see.
const STAGES = [
  { label: "Queuing request", detail: "Joining the ZeroGPU queue", ms: 1500 },
  { label: "Acquiring GPU", detail: "ZeroGPU cold start — this can take a moment", ms: 12000 },
  { label: "Tracing", detail: "Single forward pass · hooks on every layer", ms: 8000 },
  { label: "Synthesizing verdict", detail: "Surface · CAZ · Deep · GEM", ms: 60000 },
];

export function TraceProgress({
  coldStart,
  modelName,
}: {
  coldStart?: boolean;
  /** Display name of the selected model, for the warm-up note. Omitted →
   * generic wording; never hardcode a size here, it's user-selectable. */
  modelName?: string;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    STAGES.forEach((s, i) => {
      if (i === 0) return;
      elapsed += STAGES[i - 1].ms;
      timers.push(
        setTimeout(() => {
          if (!cancelled) setStage(i);
        }, elapsed),
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const current = STAGES[Math.min(stage, STAGES.length - 1)];
  const pct = ((stage + 1) / STAGES.length) * 100;

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <motion.span
            className="h-2 w-2 rounded-[1px] bg-[var(--eigan-cyan)]"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <span className="font-[var(--font-mono)] text-sm text-foreground">
            {current.label}
          </span>
        </div>
        <span className="pl-4 text-xs text-muted-foreground">{current.detail}</span>
      </div>
      <Progress value={pct} indicatorColor="var(--eigan-cyan)" />
      <div className="flex justify-between font-[var(--font-mono)] text-[0.6875rem] text-muted-foreground">
        {STAGES.map((s, i) => (
          <span
            key={s.label}
            className={i <= stage ? "text-foreground" : ""}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
        ))}
      </div>
      {coldStart && (
        <p className="text-xs text-[var(--signal-observed)]">
          The Space was asleep — the first trace after idle takes longest while{" "}
          {modelName ?? "the model"} reloads onto the GPU.
        </p>
      )}
    </div>
  );
}
