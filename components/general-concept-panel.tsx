"use client";

import { motion } from "motion/react";
import type { TraceReport } from "@/lib/spectre";
import { GENERAL_CONCEPTS } from "@/lib/spectre";
import { LayerTraceChart } from "@/components/layer-trace-chart";

/**
 * Exploratory panel for the 9 general-purpose Rosetta concepts (agency,
 * sentiment, sarcasm, ...) — display-only. GEM scores these exactly like
 * the 9 security concepts, but they can never independently or jointly
 * drive a verdict, alert, or threat match (see spectre_trace.trace
 * .SpectreTrace.SECURITY_CONCEPTS on the backend). No threshold/alert
 * semantics here, unlike ConceptScores — just raw score + GEM instantiation.
 * Absent from gem_report.per_concept (not zero-filled) until the deployed
 * probe is rebuilt with all 18 concepts.
 */
export function GeneralConceptPanel({ report }: { report: TraceReport }) {
  const scores = report.concept_scores.concept_scores ?? {};
  const perConcept = report.gem_report.per_concept ?? {};

  const present = GENERAL_CONCEPTS.filter(({ key }) => key in scores || key in perConcept);

  if (present.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-1 border border-dashed border-[var(--border)] text-center">
        <p className="text-sm text-muted-foreground">
          No general-concept data in this report.
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          The deployed probe hasn&apos;t been rebuilt with Rosetta&apos;s full
          18-concept set yet — currently scoring the 9 security concepts only.
        </p>
      </div>
    );
  }

  const rows = present
    .map(({ key, label }) => ({
      key,
      label,
      score: scores[key] ?? 0,
      instantiated: perConcept[key]?.instantiated ?? false,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Exploratory — GEM scores these the same way as the 9 security
        concepts, but nothing here can drive a verdict, alert, or threat
        match. Descriptive only.
      </p>

      <div className="flex flex-col gap-3">
        {rows.map(({ key, label, score, instantiated }, i) => (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2 text-sm text-foreground">
                {label}
                {instantiated && (
                  <span className="font-[var(--font-mono)] text-[0.625rem] uppercase tracking-wide text-[var(--eigan-cyan)]">
                    instantiated
                  </span>
                )}
              </span>
              <span className="font-[var(--font-mono)] text-xs text-muted-foreground">
                {score.toFixed(3)}
              </span>
            </div>
            <div className="relative h-1.5 w-full bg-[var(--muted)]">
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{
                  background: instantiated
                    ? "var(--eigan-cyan)"
                    : "var(--eigan-signal-blue)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(score, 1) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.03, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      <LayerTraceChart report={report} concepts={GENERAL_CONCEPTS} />
    </div>
  );
}
