import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { DraftBanner } from "@/components/schedule/draft-banner";
import { LessonSheetLoader } from "@/components/lessons/lesson-sheet-loader";
import { PageHeader } from "@/components/shell/page-header";
import { AutBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/dal/session";
import { addDays, formatKey, keyParts, mondayOfKey, type DateKey } from "@/lib/date-key";
import { isoWeek, localDateKey, localParts, zonedToUtc } from "@/lib/domain/time";
import { getCalendarData } from "@/lib/queries/calendar";
import { cn } from "@/lib/utils";

type SP = { view?: string; date?: string; instructor?: string; lesson?: string };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations("calendar");
  const locale = (await getLocale()) as "nl" | "en";
  const now = new Date();
  const todayKey = localDateKey(now);
  const view = sp.view === "day" ? "day" : "week";
  const dateKey: DateKey = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as DateKey) : todayKey;

  const data = await getCalendarData(user, { view, dateKey, instructor: sp.instructor, locale });

  const first = data.days[0];
  const last = data.days[data.days.length - 1];
  const p0 = keyParts(first);
  const week = isoWeek(zonedToUtc(p0.year, p0.month, p0.day, 12, 0)).week;
  const label =
    view === "week"
      ? t("weekLabel", { week, from: formatKey(first, locale, { day: "numeric", month: "short" }), to: formatKey(last, locale, { day: "numeric", month: "short", year: "numeric" }) })
      : t("dayLabel", { week, date: formatKey(first, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) });

  const href = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { view, date: dateKey, instructor: sp.instructor, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "view" && v === "week")) p.set(k, v);
    const s = p.toString();
    return `/agenda${s ? `?${s}` : ""}`;
  };
  const step = view === "week" ? 7 : 1;
  const base = view === "week" ? mondayOfKey(dateKey) : dateKey;

  return (
    <>
      <PageHeader
        hideSearch
        title={view === "week" ? t("title") : t("dayTitle")}
        eyebrow={label}
        actions={
          <div className="flex items-center gap-2">
            <div role="group" className="inline-flex rounded-xl border border-line bg-card p-0.5 text-sm font-semibold">
              {(["day", "week"] as const).map((v) => (
                <Link key={v} href={href({ view: v })} aria-current={view === v ? "page" : undefined} className={cn("rounded-lg px-3.5 py-1.5", view === v ? "bg-primary-soft text-primary" : "text-muted hover:text-ink")}>{t(`views.${v}`)}</Link>
              ))}
              <span title={t("monthSoon")} aria-disabled className="cursor-not-allowed rounded-lg px-3.5 py-1.5 text-muted/60">{t("views.month")}</span>
            </div>
            <Button asChild variant="outline" size="icon" className="h-10 w-10"><Link href={href({ date: addDays(base, -step) })} aria-label={t("prev")}><ChevronLeft className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline"><Link href={href({ date: todayKey })}>{t("today")}</Link></Button>
            <Button asChild variant="outline" size="icon" className="h-10 w-10"><Link href={href({ date: addDays(base, step) })} aria-label={t("next")}><ChevronRight className="h-4 w-4" /></Link></Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
        <Legend color="bg-primary" label={t("legend.practical")} />
        <Legend color="bg-theory-soft border border-theory" label={t("legend.theory")} />
        <Legend color="bg-exam" label={t("legend.exam")} />
        <Legend color="border border-dashed border-primary" label={t("legend.draft")} />
        <span className="flex items-center gap-2"><span className="rounded bg-primary px-1 py-px"><AutBadge /></span>{t("legend.automatic")}</span>
        {user.role === "ADMIN" && data.instructors.length > 1 && (
          <span className="ml-auto flex gap-1 rounded-xl border border-line bg-card p-0.5">
            <Link href={href({ instructor: "all" })} className={cn("rounded-lg px-3 py-1", data.instructorId === "all" ? "bg-primary-soft text-primary" : "text-muted")}>{t("allInstructors")}</Link>
            {data.instructors.map((i) => (
              <Link key={i.id} href={href({ instructor: i.id })} className={cn("rounded-lg px-3 py-1", data.instructorId === i.id ? "bg-primary-soft text-primary" : "text-muted")}>{i.displayName}</Link>
            ))}
          </span>
        )}
      </div>

      {data.drafts.map((d) => <DraftBanner key={d.id} draft={d} showInstructor={data.instructorId === "all"} />)}
      <CalendarBoard data={data} todayKey={todayKey} nowMin={localParts(now).minutes} />
      {sp.lesson && <LessonSheetLoader user={user} id={sp.lesson} />}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded", color)} />{label}</span>;
}
