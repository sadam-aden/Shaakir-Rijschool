import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import type { DueState } from "@/lib/domain/due";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Yellow Dutch-style licence plate with the blue NL strip. */
export function Plate({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-stretch overflow-hidden rounded-md border-2 border-black/70 bg-[#f7c600] text-black shadow-sm", className)}>
      <span className="flex w-5 items-center justify-center bg-[#003399] text-[9px] font-extrabold text-white">NL</span>
      <span className="px-2 py-0.5 font-mono text-sm font-extrabold tracking-wider">{value}</span>
    </span>
  );
}

/** One due date line: amber ≤ 30 days, red overdue. */
export function DueLine({ label, date, state }: { label: string; date: Date | null; state: DueState }) {
  const t = useTranslations("vehicles");
  const locale = useLocale() as AppLocale;
  const tone = state.kind === "overdue" ? "text-danger-ink font-bold" : state.kind === "soon" || state.kind === "today" ? "text-warn-ink font-bold" : "text-muted";
  const hint =
    state.kind === "overdue" ? t("overdue", { days: state.days })
    : state.kind === "today" ? t("dueToday")
    : state.kind === "soon" || state.kind === "ok" ? t("dueIn", { days: state.days })
    : "";
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className={tone}>
        {date ? formatDateShort(date, locale) : t("notSet")}
        {date && hint && state.kind !== "ok" ? ` · ${hint}` : ""}
      </span>
    </div>
  );
}
