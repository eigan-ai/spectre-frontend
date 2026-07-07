"use client";

import { useMemo } from "react";
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
import { CHART_COLORS, SECURITY_CONCEPTS } from "@/lib/spectre";

/**
 * Layer-depth chart, security concepts only (see SECURITY_CONCEPTS — the
 * general-concept exploratory panel has its own chart). Rebuilt for the
 * GEM-primary redesign: there's no single global per-layer curve anymore
 * (that was CAZ's live full-depth scan, removed — CAZ is build-time-only
 * now). GEM only revisits the small, already-known region(s) CAZ located at
 * build time, so a concept can have more than one disjoint layer span. Each
 * (concept, region) pair is its own line, plotted only across that region's
 * own [start_layer, end_layer] window using live_align (a per-layer cosine
 * profile) — never connected across the gap to a different region.
 */

interface SeriesKey {
  concept: string;
  regionIdx: number;
  dataKey: string;
  color: string;
  startLayer: number;
  endLayer: number;
  handoffLayer: number;
}

export function LayerTraceChart({
  report,
  concepts: conceptList = SECURITY_CONCEPTS,
}: {
  report: TraceReport;
  /** Which concepts to chart — defaults to the 9 security concepts. Pass
   * GENERAL_CONCEPTS to reuse this same chart for the exploratory panel. */
  concepts?: { key: string; label: string }[];
}) {
  const perConcept = useMemo(
    () => report.gem_report.per_concept ?? {},
    [report],
  );

  const series = useMemo<SeriesKey[]>(() => {
    const out: SeriesKey[] = [];
    let colorIdx = 0;
    for (const { key: concept } of conceptList) {
      const sig = perConcept[concept];
      if (!sig || sig.regions.length === 0) continue;
      const color = CHART_COLORS[colorIdx % CHART_COLORS.length];
      colorIdx += 1;
      for (const r of sig.regions) {
        out.push({
          concept,
          regionIdx: r.region_idx,
          dataKey: `${concept}__r${r.region_idx}`,
          color,
          startLayer: r.start_layer,
          endLayer: r.end_layer,
          handoffLayer: r.handoff_layer,
        });
      }
    }
    return out;
  }, [perConcept, conceptList]);

  const data = useMemo(() => {
    const byLayer = new Map<number, Record<string, number>>();
    for (const s of series) {
      const liveAlign = perConcept[s.concept]?.regions.find(
        (r) => r.region_idx === s.regionIdx,
      )?.live_align ?? [];
      liveAlign.forEach((v, i) => {
        const layer = s.startLayer + i;
        const row = byLayer.get(layer) ?? { layer };
        row[s.dataKey] = v;
        byLayer.set(layer, row);
      });
    }
    return Array.from(byLayer.values()).sort((a, b) => a.layer - b.layer);
  }, [series, perConcept]);

  if (series.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 border border-dashed border-[var(--border)] text-center">
        <p className="text-sm text-muted-foreground">
          No regions instantiated across the network depth.
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Regions populate when GEM instantiates at least one of these
          concepts mid-network — try the Injection or Encoded example.
        </p>
      </div>
    );
  }

  const concepts = Array.from(new Set(series.map((s) => s.concept)));
  const colorForConcept = Object.fromEntries(
    concepts.map((c) => [c, series.find((s) => s.concept === c)!.color]),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Direct labels, not legend-only (BRAND data-viz rule). */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {concepts.map((c) => {
          const regionCount = series.filter((s) => s.concept === c).length;
          return (
            <span
              key={c}
              className="flex items-center gap-1.5 font-[var(--font-mono)] text-xs"
              style={{ color: colorForConcept[c] }}
            >
              <span className="h-2 w-2" style={{ background: colorForConcept[c] }} />
              {c}
              <span className="text-muted-foreground">
                {regionCount} region{regionCount === 1 ? "" : "s"}
              </span>
            </span>
          );
        })}
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <XAxis
              dataKey="layer"
              type="number"
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
              domain={["auto", "auto"]}
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
            {series.map((s) => (
              <ReferenceLine
                key={`handoff-${s.dataKey}`}
                x={s.handoffLayer}
                stroke={s.color}
                strokeDasharray="2 3"
                strokeOpacity={0.5}
              />
            ))}
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={900}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="text-foreground">live_align</span> — cosine similarity
        between the request&apos;s activation and each region&apos;s settled
        direction, at every layer within that region&apos;s window. Dashed
        verticals mark each region&apos;s handoff layer (where the direction
        settles and the instantiation decision is scored).
      </p>
    </div>
  );
}
