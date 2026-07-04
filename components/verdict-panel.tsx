"use client";

import type { TraceReport } from "@/lib/spectre";
import { Badge } from "@/components/ui/badge";

export function VerdictPanel({ report }: { report: TraceReport }) {
  const { evidence, concepts_implicated, threat_matches } = report;

  return (
    <div className="flex flex-col gap-6">
      {concepts_implicated.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="label-system">Concepts implicated</div>
          <div className="flex flex-wrap gap-2">
            {concepts_implicated.map((c) => (
              <Badge key={c} variant="enforced">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="label-system">Evidence</div>
          <ul className="flex flex-col gap-1.5">
            {evidence.map((e, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-foreground"
              >
                <span className="select-none text-[var(--eigan-cyan)]">—</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {threat_matches.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="label-system">Threat patterns</div>
          <div className="flex flex-wrap gap-2">
            {threat_matches.map((m) => (
              <Badge key={m.pattern} variant="info" title={m.severity}>
                {m.pattern} · {m.severity}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {evidence.length === 0 &&
        concepts_implicated.length === 0 &&
        threat_matches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No concepts crossed threshold and no threat patterns matched — the
            forward pass looked clean.
          </p>
        )}
    </div>
  );
}
