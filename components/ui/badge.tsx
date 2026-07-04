import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Eigan tag: all-caps JetBrains Mono, wide tracking, solid fill, white text.
// Color encodes meaning (BRAND): navy=neutral, cyan=active, blue=info,
// green=positive, lime=secondary, destructive=enforced.
const badgeVariants = cva(
  "inline-flex items-center rounded-[2px] px-2 py-0.5 font-[var(--font-mono)] text-[0.6875rem] font-medium uppercase tracking-[0.12em] leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-primary text-primary-foreground",
        active: "bg-[var(--eigan-cyan)] text-white",
        info: "bg-[var(--eigan-signal-blue)] text-white",
        positive: "bg-[var(--eigan-green)] text-white",
        secondary: "bg-[var(--eigan-lime)] text-[#1b2355]",
        enforced: "bg-[var(--signal-enforced)] text-white",
        observed: "bg-[var(--signal-observed)] text-[#3a2a00]",
        outline:
          "border border-[var(--border)] bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
