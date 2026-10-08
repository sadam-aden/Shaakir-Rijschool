import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** KPI: label + small icon top-right, large number, grey sub-text. `highlight` = solid blue card. */
export function KpiCard({
  label, value, sub, icon, highlight, tone,
}: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; highlight?: boolean; tone?: "amber" | "red"; }) {
  return (
    <div className={cn("rounded-2xl border p-5", highlight ? "border-primary bg-primary text-white" : "border-line bg-card")}>
      <div className="flex items-start justify-between">
        <span className={cn("text-sm font-semibold", highlight ? "text-white/90" : "text-muted")}>{label}</span>
        {icon && (
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", highlight ? "bg-white/15" : tone === "amber" ? "bg-warn-soft text-warn-ink" : "bg-primary-soft text-primary")}>
            {icon}
          </span>
        )}
      </div>
      <div className={cn("mt-3 text-3xl font-bold tracking-tight", tone === "amber" && !highlight && "text-warn-ink")}>{value}</div>
      {sub && <div className={cn("mt-1 text-sm", highlight ? "text-white/80" : "text-muted")}>{sub}</div>}
    </div>
  );
}
