import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-surface-alt text-ink-muted",
        petrol: "border-transparent bg-petrol-800/10 text-petrol-800",
        low: "border-transparent bg-[color-mix(in_srgb,var(--color-risk-low)_15%,white)] text-risk-low",
        medium: "border-transparent bg-[color-mix(in_srgb,var(--color-risk-medium)_18%,white)] text-risk-medium",
        high: "border-transparent bg-[color-mix(in_srgb,var(--color-risk-high)_12%,white)] text-risk-high",
        outline: "border-border text-ink-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
