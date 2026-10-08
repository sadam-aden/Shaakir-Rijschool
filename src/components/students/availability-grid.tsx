"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { setAvailabilityAction } from "@/app/actions/students";
import type { AppLocale } from "@/i18n/config";
import { DAY_PARTS, type Avail, type DayPart } from "@/lib/domain/availability";
import { weekdayNarrow } from "@/lib/i18n-format";
import { useRunAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

const key = (weekday: number, part: DayPart) => `${weekday}:${part}`;

/** Weekly availability grid (Mon–Sat × morning/afternoon/evening). Click a cell to toggle; saves immediately. */
export function AvailabilityGrid({ studentId, initial }: { studentId: string; initial: Avail[] }) {
  const t = useTranslations("dayPart");
  const locale = useLocale() as AppLocale;
  const [cells, setCells] = useState(() => new Set(initial.map((a) => key(a.weekday, a.part))));
  const { run, pending } = useRunAction();

  function toggle(weekday: number, part: DayPart) {
    const next = new Set(cells);
    const k = key(weekday, part);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setCells(next);
    const payload = [...next].map((c) => {
      const [w, p] = c.split(":");
      return { weekday: Number(w), part: p as DayPart };
    });
    run(() => setAvailabilityAction(studentId, payload), { refresh: false });
  }

  return (
    <div className="grid grid-cols-[auto_repeat(6,minmax(0,1fr))] items-center gap-1.5" aria-busy={pending}>
      <span />
      {[1, 2, 3, 4, 5, 6].map((d) => (
        <span key={d} className="text-center text-[11px] font-bold text-muted">{weekdayNarrow(d, locale)}</span>
      ))}
      {DAY_PARTS.map((part) => (
        <div key={part} className="contents">
          <span className="pr-2 text-xs font-semibold text-muted">{t(part)}</span>
          {[1, 2, 3, 4, 5, 6].map((d) => {
            const on = cells.has(key(d, part));
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={`${t(part)} ${weekdayNarrow(d, locale)}`}
                onClick={() => toggle(d, part)}
                className={cn("h-6 rounded-md transition", on ? "bg-primary" : "bg-page hover:bg-primary-soft")}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
