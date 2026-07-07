"use client";

import type { ReactNode } from "react";
import type { TraceReport } from "@/lib/spectre";
import { SECURITY_CONCEPTS } from "@/lib/spectre";
import { Card } from "@/components/ui/card";

const SECURITY_KEYS = new Set(SECURITY_CONCEPTS.map((c) => c.key));

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border-hairline)] py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`font-[var(--font-mono)] text-xs ${
          accent ? "text-[var(--eigan-cyan)]" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function bool(v: boolean | undefined): string {
  return v === undefined ? "—" : v ? "true" : "false";
}

function num(v: number | undefined, dp = 4): string {
  return typeof v === "number" ? v.toFixed(dp) : "—";
}

function ModuleCard({
  name,
  subtitle,
  children,
}: {
  name: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <div className="label-system">{name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="flex flex-col">{children}</div>
    </Card>
  );
}

export function ModuleReports({ report }: { report: TraceReport }) {
  const s = report.surface_report;
  const g = report.gem_report;
  const d = report.deep_report;
  const propagated = d.concept_propagated ?? {};
  const perConcept = g.per_concept ?? {};
  const conceptKeys = Object.keys(perConcept);
  const securityKeys = conceptKeys.filter((k) => SECURITY_KEYS.has(k));
  const instantiatedSecurity = securityKeys.filter((k) => perConcept[k]?.instantiated);
  const instantiatedTotal = conceptKeys.filter((k) => perConcept[k]?.instantiated);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <ModuleCard name="Surface" subtitle="Lexical / tokenization layer">
        <Metric label="surface_clean" value={bool(s.surface_clean)} />
        <Metric
          label="obfuscation_detected"
          value={bool(s.obfuscation_detected)}
          accent={s.obfuscation_detected}
        />
        <Metric label="obfuscation_risk" value={num(s.obfuscation_risk)} />
        <Metric label="bpe_anomaly_count" value={s.bpe_anomaly_count ?? "—"} />
      </ModuleCard>

      <ModuleCard name="Deep" subtitle="Output-layer projection">
        <Metric label="output_entropy" value={num(d.output_entropy)} />
        <Metric
          label="output_layer_risk"
          value={num(d.output_layer_risk)}
          accent={(d.output_layer_risk ?? 0) > 0.5}
        />
        <Metric
          label="propagated"
          value={
            Object.values(propagated).filter(Boolean).length +
            "/" +
            Object.keys(propagated).length
          }
        />
        <Metric label="faded" value={d.faded_concepts?.length ?? 0} />
      </ModuleCard>

      <ModuleCard name="GEM" subtitle="Live mid-network allocation signal">
        {conceptKeys.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No GEM signals — probes for the scored concepts carry no gem_nodes
            yet. Not an error.
          </p>
        ) : (
          <>
            <Metric
              label="security instantiated"
              value={`${instantiatedSecurity.length}/${securityKeys.length}`}
              accent={instantiatedSecurity.length > 0}
            />
            <Metric
              label="total instantiated"
              value={`${instantiatedTotal.length}/${conceptKeys.length}`}
            />
            <Metric label="layers_watched" value={g.layers_watched?.length ?? "—"} />
            {instantiatedSecurity.slice(0, 4).map((k) => (
              <Metric key={k} label={k} value="instantiated" accent />
            ))}
          </>
        )}
      </ModuleCard>
    </div>
  );
}
