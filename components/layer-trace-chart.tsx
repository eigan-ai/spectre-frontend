"use client";

import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TraceReport } from "@/lib/spectre";
import { CHART_COLORS } from "@/lib/spectre";
import { cn } from "@/lib/utils";

type Mode = "raw" | "normalised";

export function LayerTraceChart({ report }: { report: TraceReport }) {
  const [mode, setMode] = useState<Mode>("raw");
  const perLayer = report.per_layer_scores ?? {};
  const layers = report.caz_report.layers_watched ?? [];
  const concepts = Object.keys(perLayer);

  const colorFor = useMemo(() => {
    const m: Record<string, string> = {};
    concepts.forEach((c, i) => (m[c] = CHART_COLORS[i % CHART_COLORS.length]));
    return m;
  }, [concepts]);

  const data = useMemo(() => {
    return layers.map((l) => {
      const row: Record<string, number> = { layer: l };
      for (const c of concepts) {
        const curve =
          mode === "raw"
            ? perLayer[c].raw_cosine_by_layer
            : perLayer[c].normalised_curve_by_layer;
        const v = curve?.[String(l)];
        if (typeof v === "number") row[c] = v;
      }
      return row;
    });
  }, [layers, concepts, perLayer, mode]);

  if (concepts.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 border border-dashed border-[var(--border)] text-center">
        <p className="text-sm text-muted-foreground">
          No concepts were allocated across the network depth.
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          The separation curves populate when CAZ allocates at least one concept
          mid-network — try the Injection or Encoded example.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Direct labels, not legend-only (BRAND data-viz rule). */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {concepts.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1.5 font-[var(--font-mono)] text-xs"
              style={{ color: colorFor[c] }}
            >
              <span className="h-2 w-2" style={{ background: colorFor[c] }} />
              {c}
              <span className="text-muted-foreground">
                @L{perLayer[c].probe_layer}
              </span>
            </span>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-[2px] border border-[var(--border)]">
          {(["raw", "normalised"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 font-[var(--font-mono)] text-[0.6875rem] uppercase tracking-wide transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <XAxis
              dataKey="layer"
              tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(27,35,85,0.12)" }}
              label={{
                value: "transformer layer",
                position: "insideBottom",
                offset: -2,
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fill: "#6b7280",
                },
              }}
            />
            <YAxis
              domain={mode === "normalised" ? [0, 1] : ["auto", "auto"]}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(27,35,85,0.12)" }}
              width={44}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 2,
                border: "1px solid rgba(27,35,85,0.12)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
              labelFormatter={(l) => `layer ${l}`}
            />
            {concepts.map((c) => (
              <ReferenceLine
                key={`peak-${c}`}
                x={perLayer[c].probe_layer}
                stroke={colorFor[c]}
                strokeDasharray="2 3"
                strokeOpacity={0.5}
              />
            ))}
            {concepts.map((c) => (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                stroke={colorFor[c]}
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={900}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {mode === "raw" ? (
          <>
            <span className="text-foreground">Raw cosine</span> — absolute signal
            strength on the same scale used for the allocation decision. Compare
            magnitudes across concepts.
          </>
        ) : (
          <>
            <span className="text-foreground">Normalised</span> — each curve
            rescaled to [0,1] for shape and peak location only; magnitudes are not
            comparable here.
          </>
        )}{" "}
        Dashed verticals mark each concept&apos;s probe layer.
      </p>
    </div>
  );
}
