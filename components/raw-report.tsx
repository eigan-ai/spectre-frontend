"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import type { TraceReport } from "@/lib/spectre";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function RawReport({ report }: { report: TraceReport }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(report, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("Report JSON copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center gap-2 font-[var(--font-mono)] text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
          />
          Raw report JSON
        </CollapsibleTrigger>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 font-[var(--font-mono)] text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          copy
        </button>
      </div>
      <CollapsibleContent>
        <pre className="mt-3 max-h-96 overflow-auto border border-[var(--border-hairline)] bg-[#0f1642] p-4 font-[var(--font-mono)] text-[0.72rem] leading-relaxed text-[#e8eaef]">
          {json}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
