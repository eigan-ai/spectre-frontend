"use client";

import type { TraceReport } from "@/lib/spectre";
import { Card } from "@/components/ui/card";

/**
 * The model's actual reply — a second, independent generation pass that
 * never feeds the Trace verdict (see lib/spectre.ts:TraceReport.response).
 * Deliberately rendered as its own thing, not gated by or paired against
 * the verdict above: Spectre is a sensor, not a guardrail, so a request can
 * show `injection_detected` and still get a response where the model
 * declined — that's expected, not a contradiction to reconcile in the UI.
 */
export function ModelResponse({ report }: { report: TraceReport }) {
  const text = report.response?.trim();

  if (!text) {
    return (
      <p className="text-sm text-muted-foreground">
        No response generated for this input.
      </p>
    );
  }

  return (
    <Card className="p-5">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {text}
      </p>
    </Card>
  );
}
