import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", {
  variants: {
    tone: {
      blue: "bg-primary-soft text-primary",
      navy: "bg-exam text-white",
      amber: "bg-warn-soft text-warn-ink",
      green: "bg-success-soft text-success-ink",
      red: "bg-danger-soft text-danger-ink",
      grey: "bg-page text-muted",
      theory: "bg-theory-soft text-theory-ink",
    },
  },
  defaultVariants: { tone: "grey" },
});

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

/** Small "AUT" marker for automatic-gearbox lessons. */
export function AutBadge({ className }: { className?: string }) {
  return (
    <span className={cn("rounded bg-white/90 px-1 py-px text-[9px] font-extrabold uppercase text-primary", className)}>AUT</span>
  );
}
