"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsible JSON tree — per-node expand/collapse, not just show/hide the
 * whole block (that's RawReport's outer Collapsible). Hand-rolled rather
 * than a JSON-viewer package: the report is deeply nested (gem_report
 * .per_concept.<concept>.regions[].live_align, 9-18 concepts) and existing
 * libraries ship their own opinionated theme that would need overriding
 * anyway to match the Eigan console styling already established here.
 */

const INDENT_PX = 14;
const GUTTER_PX = 16; // chevron (12px) + gap (4px) — leaf rows spacer to align keys
const DEFAULT_OPEN_DEPTH = 2; // root + first level open; per_concept-style depth collapsed

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isPrimitive(v: Json): v is string | number | boolean | null {
  return v === null || typeof v !== "object";
}

function Key({ name }: { name: string }) {
  return <span className="text-[var(--eigan-cyan)]">&quot;{name}&quot;</span>;
}

function Punct({ children }: { children: ReactNode }) {
  return <span className="text-[#8890b5]">{children}</span>;
}

function PrimitiveValue({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span className="text-[#8890b5]">null</span>;
  if (typeof value === "string") {
    return <span className="text-[var(--eigan-lime)]">&quot;{value}&quot;</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-[var(--signal-observed)]">{String(value)}</span>;
  }
  return <span className="text-[#e8eaef]">{value}</span>;
}

function inlinePrimitiveArray(arr: (string | number | boolean | null)[]): string {
  return `[${arr
    .map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
    .join(", ")}]`;
}

function Row({
  depth,
  name,
  children,
}: {
  depth: number;
  name?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ paddingLeft: depth * INDENT_PX }}
      className="whitespace-pre-wrap break-all"
    >
      <span className="inline-block" style={{ width: GUTTER_PX }} />
      {name !== undefined && (
        <>
          <Key name={name} />
          <Punct>: </Punct>
        </>
      )}
      {children}
    </div>
  );
}

function Branch({
  depth,
  name,
  open: openProp,
  toggle,
  openBracket,
  closeBracket,
  count,
  countLabel,
  children,
}: {
  depth: number;
  name?: string;
  open: boolean;
  toggle: () => void;
  openBracket: string;
  closeBracket: string;
  count: number;
  countLabel: string;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        style={{ paddingLeft: depth * INDENT_PX }}
        className="flex w-full cursor-pointer items-start gap-0 whitespace-pre-wrap break-all text-left hover:bg-white/5"
      >
        <ChevronRight
          className={cn(
            "mt-[3px] size-3 shrink-0 text-[#8890b5] transition-transform",
            openProp && "rotate-90",
          )}
        />
        <span>
          {name !== undefined && (
            <>
              <Key name={name} />
              <Punct>: </Punct>
            </>
          )}
          <Punct>{openBracket}</Punct>
          {!openProp && (
            <Punct>{` ${count} ${countLabel} ${closeBracket}`}</Punct>
          )}
        </span>
      </button>
      {openProp && (
        <>
          {children}
          <div style={{ paddingLeft: depth * INDENT_PX }} className="whitespace-pre">
            <span className="inline-block" style={{ width: GUTTER_PX }} />
            <Punct>{closeBracket}</Punct>
          </div>
        </>
      )}
    </div>
  );
}

export function JsonNode({
  value,
  name,
  depth = 0,
}: {
  value: Json;
  name?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < DEFAULT_OPEN_DEPTH);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <Row depth={depth} name={name}>
          <Punct>[]</Punct>
        </Row>
      );
    }
    if (value.every(isPrimitive)) {
      return (
        <Row depth={depth} name={name}>
          <Punct>{inlinePrimitiveArray(value)}</Punct>
        </Row>
      );
    }
    return (
      <Branch
        depth={depth}
        name={name}
        open={open}
        toggle={() => setOpen((o) => !o)}
        openBracket="["
        closeBracket="]"
        count={value.length}
        countLabel={value.length === 1 ? "item" : "items"}
      >
        {value.map((v, i) => (
          <JsonNode key={i} value={v} name={String(i)} depth={depth + 1} />
        ))}
      </Branch>
    );
  }

  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return (
        <Row depth={depth} name={name}>
          <Punct>{"{}"}</Punct>
        </Row>
      );
    }
    return (
      <Branch
        depth={depth}
        name={name}
        open={open}
        toggle={() => setOpen((o) => !o)}
        openBracket="{"
        closeBracket="}"
        count={keys.length}
        countLabel={keys.length === 1 ? "key" : "keys"}
      >
        {keys.map((k) => (
          <JsonNode key={k} value={value[k]} name={k} depth={depth + 1} />
        ))}
      </Branch>
    );
  }

  return (
    <Row depth={depth} name={name}>
      <PrimitiveValue value={value} />
    </Row>
  );
}

export function JsonTree({ data }: { data: unknown }) {
  return <JsonNode value={data as Json} depth={0} />;
}
