import { Sparkles } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/config";
import type { SessionUser } from "@/lib/dal/session";
import { previewSchedule } from "@/lib/dal/schedule";
import { addDays, formatKey } from "@/lib/date-key";
import { localDateKey } from "@/lib/domain/time";
import { getGenerateOptions } from "@/lib/queries/schedule-options";
import { GenerateDayButton } from "./generate-day-button";

/**
 * Blue banner on the dashboard when the next working day is not planned yet (or a draft is waiting for review).
 * Chips show what the planner sees; "Genereer morgen" drafts the day in one click, the link opens the calendar.
 */
export async function AiBanner({ user }: { user: SessionUser }) {
  if (!user.instructorId) return null;
  const options = await getGenerateOptions(user);
  const mine = options.instructors.find((i) => i.id === user.instructorId);
  if (!mine) return null;
  const locale = (await getLocale()) as AppLocale;
  const preview = await previewSchedule(user, mine.id, mine.defaultDate, locale);
  if (!preview.ok) return null;
  const p = preview.data;
  const hasDraft = !!p.pendingDraftId;
  if (!p.workingDay || (!hasDraft && p.plannedPractical > 0)) return null;

  const t = await getTranslations("schedule.banner");
  const tomorrow = addDays(localDateKey(new Date()), 1);
  // "morgen" / "zaterdag" in the middle of a sentence, capitalised at the start of one
  const when = mine.defaultDate === tomorrow ? t("tomorrow") : formatKey(mine.defaultDate, locale, { weekday: "long" });
  const whenStart = when.replace(/^./, (c) => c.toUpperCase());
  const dateLabel = formatKey(mine.defaultDate, locale, { weekday: "long", day: "numeric", month: "long" });
  const examDay = p.examNote ? formatKey(p.examNote.at.slice(0, 10), locale, { weekday: "long" }) : "";

  return (
    <section className="mb-6 flex flex-wrap items-center gap-6 rounded-3xl bg-primary p-6 text-white" aria-label={t("eyebrow", { when, date: dateLabel })}>
      <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex"><Sparkles className="h-7 w-7" aria-hidden /></span>
      <div className="min-w-0 flex-1 basis-60 sm:basis-96">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">{t("eyebrow", { when, date: dateLabel })}</p>
        <h2 className="mt-1 text-2xl font-bold leading-snug">{hasDraft ? t("titleDraft", { when }) : t("title", { when: whenStart })}</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/15 px-3.5 py-1.5">{t("chipStudents", { n: p.studentsAvailable })}</span>
          <span className="rounded-full bg-white/15 px-3.5 py-1.5">{t("chipSlots", { n: p.openPracticalSlots })}</span>
          {p.theoryGroups > 0 && <span className="rounded-full bg-white/15 px-3.5 py-1.5">{t("chipTheory", { n: p.theoryGroups })}</span>}
          {p.examNote && <span className="rounded-full bg-white/15 px-3.5 py-1.5">{t("chipExam", { name: p.examNote.name, day: examDay })}</span>}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        {hasDraft ? (
          <Link href={`/agenda?date=${mine.defaultDate}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-sm hover:bg-primary-faint">
            <Sparkles className="h-4 w-4" aria-hidden />{t("review")}
          </Link>
        ) : (
          <GenerateDayButton instructorId={mine.id} dateKey={mine.defaultDate} when={when} />
        )}
        <Link href={`/agenda?date=${mine.defaultDate}`} className="text-xs font-bold underline underline-offset-2">{t("link")}</Link>
      </div>
    </section>
  );
}
