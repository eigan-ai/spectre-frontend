"use client";

import type { ReactNode } from "react";
import type { TraceReport } from "@/lib/spectre";
import { Card } from "@/components/ui/card";

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
  const c = report.caz_report;
  const d = report.deep_report;
  const propagated = d.concept_propagated ?? {};
  const gemAlerts = report.gem_report?.alerts;
  const gemCorroborated = !Array.isArray(gemAlerts)
    ? gemAlerts?.corroborated ?? []
    : [];
  const gemElevated = !Array.isArray(gemAlerts) ? gemAlerts?.elevated ?? [] : [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <ModuleCard name="CAZ" subtitle="Concept allocation zones">
        <Metric
          label="allocated"
          value={c.allocated_concepts?.length ?? 0}
          accent={(c.allocated_concepts?.length ?? 0) > 0}
        />
        <Metric label="layers_watched" value={c.layers_watched?.length ?? "—"} />
        {(c.allocated_concepts ?? []).slice(0, 4).map((k) => (
          <Metric key={k} label={k} value="allocated" />
        ))}
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

      <ModuleCard name="GEM" subtitle="Trajectory-match signals">
        {gemCorroborated.length === 0 && gemElevated.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No GEM signals — probes for the allocated concepts carry no gem_nodes
            yet. Not an error.
          </p>
        ) : (
          <>
            <Metric label="corroborated" value={gemCorroborated.length} />
            <Metric
              label="elevated"
              value={gemElevated.length}
              accent={gemElevated.length > 0}
            />
            {gemElevated.slice(0, 3).map((k) => (
              <Metric key={k} label={k} value="elevated" />
            ))}
          </>
        )}
      </ModuleCard>
    </div>
  );
}
