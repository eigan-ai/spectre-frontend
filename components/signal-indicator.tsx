"use client";

import { motion } from "motion/react";
import type { TraceReport } from "@/lib/spectre";
import { SIGNAL_HEX, SIGNAL_TIER_LABEL, VERDICT_GLOSS } from "@/lib/spectre";

export function SignalIndicator({ report }: { report: TraceReport }) {
  const tier = report.signal.tier;
  const hex = SIGNAL_HEX[tier];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
      {/* Precise instrument readout — a solid signal block, no glow. */}
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="h-14 w-14 shrink-0 rounded-[2px]"
          style={{ background: hex }}
          aria-hidden
        />
        <div>
          <div
            className="label-system"
            style={{ color: hex, letterSpacing: "0.28em" }}
          >
            {SIGNAL_TIER_LABEL[tier]}
          </div>
          <div className="font-[var(--font-mono)] text-xl text-foreground">
            {report.verdict}
          </div>
        </div>
      </div>

      <div className="hidden h-14 w-px bg-[var(--border-hairline)] md:block" />

      <div className="flex flex-1 flex-col gap-2">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {VERDICT_GLOSS[report.verdict]}
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-1 font-[var(--font-mono)] text-xs text-muted-foreground">
          <span>
            confidence{" "}
            <span className="text-foreground">
              {(report.confidence * 100).toFixed(0)}%
            </span>
          </span>
          <span>
            trace{" "}
            <span className="text-foreground">
              {report.trace_time_ms.toFixed(0)} ms
            </span>
          </span>
          <span>
            concepts{" "}
            <span className="text-foreground">
              {report.concepts_implicated.length || "none"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
