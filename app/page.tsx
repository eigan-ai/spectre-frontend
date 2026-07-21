"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import type { ExamplePrompt, ModelOption, TraceReport } from "@/lib/spectre";
import { DEFAULT_MODEL } from "@/lib/spectre";
import { ExamplePrompts } from "@/components/example-prompts";
import { SignalIndicator } from "@/components/signal-indicator";
import { ModelResponse } from "@/components/model-response";
import { VerdictPanel } from "@/components/verdict-panel";
import { ConceptScores } from "@/components/concept-scores";
import { LayerTraceChart } from "@/components/layer-trace-chart";
import { GeneralConceptPanel } from "@/components/general-concept-panel";
import { ModuleReports } from "@/components/module-reports";
import { RawReport } from "@/components/raw-report";
import { TraceProgress } from "@/components/trace-progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="label-system mb-4">{children}</div>;
}

export default function Home() {
  const [text, setText] = useState("");
  const [report, setReport] = useState<TraceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coldStart, setColdStart] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([DEFAULT_MODEL]);
  const [modelId, setModelId] = useState(DEFAULT_MODEL.id);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((res) => res.json())
      .then((data: ModelOption[]) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setModels(data);
        // Only adopt the fetched default if the user hasn't already picked
        // something else (e.g. a fast click before this resolves).
        setModelId((current) =>
          data.some((m) => m.id === current) ? current : data[0].id,
        );
      })
      .catch(() => {
        // Keep the DEFAULT_MODEL fallback already in state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setReport(null);
    // NOTE: `coldStart` is deliberately NOT reset here. If the last attempt
    // told us the Space was asleep, that's still true while the retry runs —
    // clearing it up front is exactly when the warm-up hint is most useful.
    // Cleared on success instead, below.
    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: modelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.stage === "cold_start") setColdStart(true);
        setError(data.error ?? "Trace failed.");
      } else {
        setColdStart(false); // it's warm now
        setReport(data as TraceReport);
      }
    } catch {
      setError("Network error — could not reach the trace endpoint.");
    } finally {
      setLoading(false);
    }
  }, [text, loading, modelId]);

  const pick = useCallback((e: ExamplePrompt) => {
    setText(e.text);
    setReport(null);
    setError(null);
  }, []);

  return (
    <>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-8 py-16 md:py-24">
        {/* Hero — restrained, no gradient. The story is in the data. */}
        <section className="max-w-2xl">
          <div className="label-system mb-4">Inference Analysis · Spectre Trace</div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl">
            See what the model was thinking.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Spectre reads the internal geometry of a single forward pass and
            reports the security concepts it allocated across the
            network&apos;s depth — not just what it said. A sensor, not a
            guardrail.
          </p>
        </section>

        {/* Console */}
        <section className="mt-12">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
            }}
            placeholder="Enter a prompt to trace…  (⌘/Ctrl + Enter to run)"
            className="min-h-32 text-base"
            disabled={loading}
          />
          <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <ExamplePrompts onPick={pick} disabled={loading} />
            <div className="flex shrink-0 items-center gap-3">
              <Select value={modelId} onValueChange={setModelId} disabled={loading}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="lg"
                onClick={run}
                disabled={loading || !text.trim()}
                className="shrink-0"
              >
                {loading ? "Tracing…" : "Run Trace"}
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </div>
          </div>
        </section>

        {/* Results */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.section
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-16 border-t border-[var(--border-hairline)] pt-10"
            >
              <TraceProgress
                coldStart={coldStart}
                modelName={models.find((m) => m.id === modelId)?.display_name}
              />
            </motion.section>
          )}

          {!loading && error && (
            <motion.section
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-16 border-t border-[var(--border-hairline)] pt-10"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0"
                  style={{ color: "var(--signal-observed)" }}
                />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {coldStart ? "Space is waking up" : "Trace failed"}
                  </div>
                  <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                    {error}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={run}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </motion.section>
          )}

          {!loading && report && (
            <motion.section
              key="report"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-16 flex flex-col gap-14 border-t border-[var(--border-hairline)] pt-10"
            >
              <div>
                <SectionLabel>Signal</SectionLabel>
                <SignalIndicator report={report} />
              </div>

              <div>
                <SectionLabel>Model response</SectionLabel>
                <ModelResponse report={report} />
              </div>

              <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1.4fr_1fr]">
                <div>
                  <SectionLabel>Trace across network depth</SectionLabel>
                  <LayerTraceChart report={report} />
                </div>
                <div>
                  <SectionLabel>Verdict &amp; evidence</SectionLabel>
                  <VerdictPanel report={report} />
                </div>
              </div>

              <div>
                <SectionLabel>Concept scores</SectionLabel>
                <ConceptScores report={report} />
              </div>

              <div>
                <SectionLabel>Module reports</SectionLabel>
                <ModuleReports report={report} />
              </div>

              <div>
                <SectionLabel>General concepts (exploratory)</SectionLabel>
                <GeneralConceptPanel report={report} />
              </div>

              <RawReport report={report} />
            </motion.section>
          )}

          {!loading && !report && !error && (
            <motion.section
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-16 border-t border-[var(--border-hairline)] pt-10"
            >
              <Card className="flex flex-col items-start gap-2 p-8">
                <div className="label-system">Awaiting input</div>
                <p className="max-w-lg text-sm text-muted-foreground">
                  Enter a prompt or pick an example, then run the trace. Each run
                  is a single forward pass on ZeroGPU — the first after idle takes
                  longer while the model reloads.
                </p>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-[var(--border-hairline)]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-8 py-8">
          <span className="label-system">Eigan · Spectre</span>
          <p className="max-w-lg text-xs text-muted-foreground">
            Verdicts describe what the model&apos;s forward pass looked like
            internally. They are not a judgment on whether the response was safe
            — enforcement is a downstream Sentinel decision.
          </p>
        </div>
      </footer>
    </>
  );
}
