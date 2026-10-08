import { cn } from "@/lib/utils";

/** Horizontal bar; `tone="auto"` turns amber when little is left. */
export function ProgressBar({
  value, max, tone = "blue", className, label,
}: { value: number; max: number; tone?: "blue" | "amber" | "grey"; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-primary-soft", className)}
    >
      <div
        className={cn("h-full rounded-full", tone === "amber" ? "bg-theory" : tone === "grey" ? "bg-muted" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Circular ring used on the student detail panel. */
export function Ring({ value, max, label, size = 64 }: { value: number; max: number; label: string; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} className="stroke-primary-soft" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} className="stroke-primary"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{label}</span>
    </div>
  );
}
