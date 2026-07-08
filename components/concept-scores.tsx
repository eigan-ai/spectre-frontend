"use client";

import { motion } from "motion/react";
import type { TraceReport } from "@/lib/spectre";
import { SECURITY_CONCEPTS } from "@/lib/spectre";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type State = "alert" | "allocated" | "faded" | "marginal" | "quiet";

const STATE_COLOR: Record<State, string> = {
  alert: "var(--signal-enforced)",
  allocated: "var(--eigan-cyan)",
  faded: "var(--signal-observed)",
  marginal: "var(--muted-foreground)",
  quiet: "var(--eigan-signal-blue)",
};

const STATE_NOTE: Record<State, string> = {
  alert: "Crossed threshold AND cross-validated by GEM instantiation.",
  allocated: "Instantiated mid-network by GEM.",
  faded: "Instantiated mid-network, then faded before the output layer.",
  marginal:
    "Crossed the raw single-layer threshold, but GEM never confirmed it — not itself an alert. The raw score alone isn't a reliable signal for this concept.",
  quiet: "Below the raw single-layer threshold.",
};

export function ConceptScores({ report }: { report: TraceReport }) {
  const scores = report.concept_scores.concept_scores ?? {};
  const thresholds = report.concept_scores.thresholds ?? {};
  const alerts = new Set(report.concept_scores.alerts ?? []);
  const gemPerConcept = report.gem_report.per_concept ?? {};
  const faded = new Set(report.deep_report.faded_concepts ?? []);

  const rows = SECURITY_CONCEPTS.map(({ key, label }) => {
    const score = scores[key] ?? 0;
    const threshold = thresholds[key] ?? 0.5;
    const instantiated = gemPerConcept[key]?.instantiated ?? false;
    // "marginal" vs "quiet" is a literal score-vs-threshold comparison —
    // must match what the bar/tick actually render below, or the tooltip
    // contradicts the visual (the bug this fixes: score past the tick but
    // tooltip said "below the bar", because that text described GEM
    // cross-validation, a different signal than the raw threshold shown).
    let state: State = score >= threshold ? "marginal" : "quiet";
    if (alerts.has(key)) state = "alert";
    else if (faded.has(key)) state = "faded";
    else if (instantiated) state = "allocated";
    return { key, label, score, threshold, state };
  }).sort((a, b) => b.score - a.score);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-3">
        {rows.map(({ key, label, score, threshold, state }, i) => (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-foreground">{label}</span>
              <span className="font-[var(--font-mono)] text-xs text-muted-foreground">
                {score.toFixed(3)}
                <span className="text-[var(--muted-foreground)]/60">
                  {" "}
                  / {threshold.toFixed(2)}
                </span>
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative h-1.5 w-full cursor-default bg-[var(--muted)]">
                  {/* score fill — 6px bar, no radius (BRAND data-viz rule) */}
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ background: STATE_COLOR[state] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(score, 1) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.03, ease: "easeOut" }}
                  />
                  {/* threshold marker */}
                  <div
                    className="absolute inset-y-[-2px] w-px bg-foreground/40"
                    style={{ left: `${Math.min(threshold, 1) * 100}%` }}
                    aria-hidden
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-[var(--font-mono)] uppercase tracking-wide">
                  {state}
                </span>{" "}
                — {STATE_NOTE[state]}
              </TooltipContent>
            </Tooltip>
          </div>
        ))}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-[var(--font-mono)] text-[0.6875rem] text-muted-foreground">
          <Legend color={STATE_COLOR.alert} label="alert" />
          <Legend color={STATE_COLOR.allocated} label="allocated" />
          <Legend color={STATE_COLOR.faded} label="faded" />
          <Legend color={STATE_COLOR.marginal} label="marginal (uncorroborated)" />
          <span>| vertical tick = threshold</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2" style={{ background: color }} />
      {label}
    </span>
  );
}
