"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { bulkCompleteAction } from "@/app/actions/lessons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/config";
import { formatDateLong, formatTime } from "@/lib/format";
import { useRunAction } from "@/lib/use-action";

export type LessonRow = {
  id: string; startsAt: string; endsAt: string; durationMin: number; type: "PRACTICAL" | "THEORY" | "EXAM";
  status: "DRAFT" | "PLANNED" | "COMPLETED" | "NO_SHOW" | "CANCELLED_STUDENT" | "CANCELLED_SCHOOL";
  student: string | null; instructor: string; car: string | null; title: string | null; needsCheckOff: boolean;
};
const tone = { PLANNED: "blue", DRAFT: "grey", COMPLETED: "green", NO_SHOW: "amber", CANCELLED_STUDENT: "grey", CANCELLED_SCHOOL: "grey" } as const;

export function LessonTable({ rows, hrefFor, showCheckOff }: { rows: LessonRow[]; hrefFor: Record<string, string>; showCheckOff: boolean }) {
  const t = useTranslations("lessons");
  const ts = useTranslations("lessonStatus");
  const tt = useTranslations("lessonType");
  const locale = useLocale() as AppLocale;
  const { run, pending } = useRunAction();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const selectable = rows.filter((r) => r.needsCheckOff && r.type !== "THEORY");
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div>
      {showCheckOff && selectable.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-warn-soft/50 px-5 py-3 text-sm">
          <span className="font-semibold text-warn-ink">{t("checkOff.banner", { n: selectable.length })}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSel(sel.size === selectable.length ? new Set() : new Set(selectable.map((r) => r.id)))}>{t("checkOff.select")}</Button>
            <Button size="sm" disabled={pending || sel.size === 0} onClick={() => run(() => bulkCompleteAction([...sel]), { success: t("checkOff.done", { n: sel.size }), onOk: () => setSel(new Set()) })}>
              <Check className="h-3.5 w-3.5" aria-hidden />{t("checkOff.all")} ({sel.size})
            </Button>
          </div>
        </div>
      )}
      <div role="table">
        <div role="row" className="grid grid-cols-[32px_1.6fr_1.3fr_1fr_1fr_1fr_1fr] gap-3 border-b border-line bg-page/60 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
          <span /><span>{t("cols.when")}</span><span>{t("cols.student")}</span><span>{t("cols.type")}</span><span>{t("cols.instructor")}</span><span>{t("cols.car")}</span><span>{t("cols.status")}</span>
        </div>
        {rows.map((r) => {
          const start = new Date(r.startsAt);
          return (
            <div key={r.id} role="row" className="grid grid-cols-[32px_1.6fr_1.3fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0 hover:bg-primary-faint">
              <span>{showCheckOff && r.needsCheckOff && r.type !== "THEORY" && <input type="checkbox" aria-label={t("checkOff.select")} checked={sel.has(r.id)} onChange={() => toggle(r.id)} />}</span>
              <Link href={hrefFor[r.id]} className="contents">
                <span><span className="block font-bold">{formatDateLong(start, locale)}</span><span className="text-xs text-muted">{formatTime(start, locale)} · {r.durationMin} min</span></span>
                <span className="font-semibold">{r.title ?? r.student ?? "—"}</span>
                <span><Badge tone={r.type === "THEORY" ? "theory" : r.type === "EXAM" ? "navy" : "blue"}>{tt(r.type)}</Badge></span>
                <span className="text-muted">{r.instructor}</span>
                <span className="truncate text-muted">{r.car ?? "—"}</span>
                <span><Badge tone={r.needsCheckOff ? "amber" : tone[r.status]}>{ts(r.status)}</Badge></span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
