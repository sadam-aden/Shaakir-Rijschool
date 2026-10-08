import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, initialsOf } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/config";
import { formatHours } from "@/lib/format";
import { hoursNumber } from "@/lib/i18n-format";
import type { StudentRow } from "@/lib/queries/students";
import { cn } from "@/lib/utils";
import { DayPills, GearboxTag, StatusBadge, WhenText } from "./bits";

export function StudentTable({
  rows, selectedId, hrefFor, lowHoursMinutes,
}: { rows: StudentRow[]; selectedId?: string; hrefFor: (id: string) => string; lowHoursMinutes: number }) {
  const t = useTranslations("students");
  const tl = useTranslations("lessonType");
  const locale = useLocale() as AppLocale;

  return (
    <div role="table" className="overflow-hidden">
      <div role="row" className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.5fr)] gap-3 border-b border-line bg-page/60 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
        <span role="columnheader">{t("cols.student")}</span>
        <span role="columnheader">{t("cols.remaining")}</span>
        <span role="columnheader">{t("cols.availability")}</span>
        <span role="columnheader">{t("cols.next")}</span>
        <span role="columnheader">{t("cols.status")}</span>
      </div>
      {rows.map((r) => {
        const theory = r.track === "THEORY_ONLY";
        const low = !theory && r.minutesAvailable < lowHoursMinutes;
        return (
          <Link
            key={r.id}
            href={hrefFor(r.id)}
            role="row"
            aria-current={selectedId === r.id ? "true" : undefined}
            className={cn(
              "grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.5fr)] items-center gap-3 border-b border-line px-5 py-3.5 transition last:border-b-0 hover:bg-primary-faint",
              selectedId === r.id && "border-l-[3px] border-l-primary bg-primary-faint pl-[17px]",
            )}
          >
            <span role="cell" className="flex min-w-0 items-center gap-3">
              <Avatar initials={initialsOf(r.firstName, r.lastName)} solid={selectedId === r.id} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{r.firstName} {r.lastName}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <GearboxTag gearbox={r.gearbox} />
                  <span className="truncate">
                    {theory ? t("theoryPackage") : r.lessonCount > 0 ? t("lessonsCount", { n: r.lessonCount }) : ""}
                  </span>
                </span>
              </span>
            </span>
            <span role="cell">
              {theory ? (
                <>
                  <span className="text-sm font-bold">{t("classesOf", { done: r.theoryAttended, total: r.theoryTotal })}</span>
                  <ProgressBar value={r.theoryAttended} max={r.theoryTotal} tone="amber" className="mt-1.5" />
                </>
              ) : (
                <>
                  <span className="text-sm font-bold">
                    {t("hoursOf", { left: hoursNumber(r.minutesRemaining, locale), total: formatHours(r.minutesPurchased, locale) })}
                  </span>
                  <ProgressBar value={r.minutesRemaining} max={r.minutesPurchased} tone={low ? "amber" : "blue"} className="mt-1.5" />
                </>
              )}
            </span>
            <span role="cell"><DayPills availability={r.availability} /></span>
            <span role="cell" className="text-sm">
              {r.nextLesson ? (
                <>
                  <span className="block font-bold"><WhenText date={r.nextLesson.startsAt} /></span>
                  <span className="block text-xs text-muted">
                    {r.nextLesson.type === "THEORY" ? t("next.theoryGroup") : `${tl(r.nextLesson.type)} · ${r.nextLesson.durationMin} min`}
                    {r.nextLesson.draft ? ` · ${t("next.drafted")}` : ""}
                  </span>
                </>
              ) : (
                <>
                  <span className="block font-bold">{t("next.none")}</span>
                  {!theory && <span className="block text-xs text-muted">{t("next.needs", { min: 90 })}</span>}
                </>
              )}
            </span>
            <span role="cell"><StatusBadge status={r.derived} /></span>
          </Link>
        );
      })}
    </div>
  );
}
