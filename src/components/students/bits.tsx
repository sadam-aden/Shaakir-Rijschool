import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/config";
import type { Avail } from "@/lib/domain/availability";
import { groupByPart } from "@/lib/domain/availability";
import type { DerivedStatus } from "@/lib/domain/student-status";
import { formatDateShort } from "@/lib/format";
import { formatDayLabel, formatWeekdayShort, sameLocalDay, weekdayNarrow, weekdayShort } from "@/lib/i18n-format";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Mon–Sat availability pills (M T W T F S). */
export function DayPills({ availability }: { availability: Avail[] }) {
  const locale = useLocale() as AppLocale;
  const on = new Set(availability.map((a) => a.weekday));
  return (
    <div className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5, 6].map((d) => (
        <span
          key={d}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold",
            on.has(d) ? "bg-primary text-white" : "bg-page text-muted",
          )}
        >
          {weekdayNarrow(d, locale)}
        </span>
      ))}
    </div>
  );
}

/** "Wed · Sat mornings" style summary used on planner cards. */
export function AvailabilityText({ availability }: { availability: Avail[] }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("dayPartPlural");
  const groups = groupByPart(availability);
  if (groups.length === 0) return null;
  return (
    <>
      {groups.map((g, i) => (
        <span key={g.part}>
          {i > 0 && " · "}
          {g.days.map((d) => weekdayShort(d, locale)).join(" · ")} {t(g.part)}
        </span>
      ))}
    </>
  );
}

export function StatusBadge({ status }: { status: DerivedStatus }) {
  return <span className="inline-flex [&>span]:whitespace-normal [&>span]:leading-tight"><StatusBadgeInner status={status} /></span>;
}

function StatusBadgeInner({ status }: { status: DerivedStatus }) {
  const t = useTranslations("students.status");
  const locale = useLocale() as AppLocale;
  switch (status.kind) {
    case "examRequested":
      return <Badge tone="navy">{t("examRequested")}</Badge>;
    case "cbrExam":
      return <Badge tone="navy">{t("cbrExam", { day: formatWeekdayShort(status.at, locale) })}</Badge>;
    case "theoryExam":
      return <Badge tone="blue">{t("theoryExam", { date: formatDateShort(status.at, locale) })}</Badge>;
    case "lowHours":
      return <Badge tone="amber">{t("lowHours")}</Badge>;
    case "theoryOnly":
      return <Badge tone="amber">{t("theoryOnly")}</Badge>;
    case "active":
      return <Badge tone="blue">{t("active")}</Badge>;
    default:
      return <Badge tone="grey">{t(status.kind)}</Badge>;
  }
}

export function GearboxTag({ gearbox }: { gearbox: "MANUAL" | "AUTOMATIC" }) {
  const t = useTranslations("gearbox");
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        gearbox === "AUTOMATIC" ? "bg-success-soft text-success-ink" : "bg-page text-muted",
      )}
    >
      {t(gearbox)}
    </span>
  );
}

/** "Today · 09:45" / "di 29 sep · 14:30". */
export function WhenText({ date }: { date: Date }) {
  const t = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const day = sameLocalDay(date, new Date()) ? t("today") : formatDayLabel(date, locale);
  return <>{day} · {formatTime(date, locale)}</>;
}
