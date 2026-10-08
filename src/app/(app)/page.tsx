import { AlertTriangle, CalendarClock, ClipboardCheck, Clock, Users, Wallet, BookOpen } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { TopUpButton } from "@/components/dashboard/top-up-button";
import { PageHeader } from "@/components/shell/page-header";
import { AutBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { ProgressBar } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/config";
import { requireUser } from "@/lib/dal/session";
import { greetingKey } from "@/lib/domain/time";
import { formatDateShort, formatHours, formatMoney, formatTime } from "@/lib/format";
import { getDashboard } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const td = await getTranslations("dashboard");
  const tg = await getTranslations("gearbox");
  const locale = (await getLocale()) as AppLocale;
  const isAdmin = user.role === "ADMIN";
  const d = await getDashboard(user, locale);
  const k = d.kpis;
  const pct = k.capacityMinutes > 0 ? Math.round((k.plannedWeekMinutes / k.capacityMinutes) * 100) : 0;

  return (
    <>
      <PageHeader title={t(`greeting.${greetingKey(new Date())}`, { name: user.name.split(" ")[0] })} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={td("lessonsToday")} icon={<Clock className="h-4 w-4" />}
          value={k.todayPractical + k.todayTheory}
          sub={td("lessonsTodaySub", { practical: k.todayPractical, theory: k.todayTheory, hours: formatHours(k.todayMinutes, locale) })}
        />
        <KpiCard label={td("activeStudents")} icon={<Users className="h-4 w-4" />} value={k.activeStudents} sub={td("examsThisMonth", { n: k.examsThisMonth })} />
        <KpiCard
          label={isAdmin ? td("plannedWeek") : td("myHoursWeek")} icon={<CalendarClock className="h-4 w-4" />}
          value={formatHours(k.plannedWeekMinutes, locale)}
          sub={
            <div className="flex items-center gap-3">
              <ProgressBar value={k.plannedWeekMinutes} max={k.capacityMinutes} className="flex-1" label={td("plannedWeek")} />
              <span className="text-xs font-bold text-ink">{td("percentFull", { n: pct })}</span>
            </div>
          }
        />
        {isAdmin && (
          <KpiCard
            label={td("outstanding")} icon={<Wallet className="h-4 w-4" />} tone="amber" value={formatMoney(k.outstandingCents, locale)}
            sub={<>{td("outstandingSub", { open: k.openInvoices })}{k.overdueInvoices > 0 && <> · <span className="font-bold text-danger-ink underline">{td("overdueLink", { n: k.overdueInvoices })}</span></>}</>}
          />
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-6">
          <CardHeader
            title={td("todaysLessons")}
            action={
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-primary"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />{td("legendPractical")}</span>
                <span className="flex items-center gap-1.5 text-theory-ink"><span className="h-2.5 w-2.5 rounded-sm bg-theory" />{td("legendTheory")}</span>
                <Link href="/agenda" className="text-primary">{td("openCalendar")}</Link>
              </div>
            }
          />
          {d.today.length === 0 ? (
            <EmptyState>{td("noLessonsToday")}</EmptyState>
          ) : (
            <ul className="space-y-2">
              {d.today.map((l) => {
                const theory = l.type === "THEORY";
                const needsCheck = l.status === "PLANNED" && l.past;
                const meta = theory
                  ? `${td("classroom")} · ${td("seatsOf", { n: l.seats?.n ?? 0, cap: l.seats?.cap ?? 10 })}`
                  : [l.gearbox ? tg(l.gearbox) : null, l.area, l.lessonNo && l.lessonTotal ? td("lessonOf", { n: l.lessonNo, m: l.lessonTotal }) : null, l.note].filter(Boolean).join(" · ");
                return (
                  <li key={l.id}>
                    <Link
                      href={`/agenda?lesson=${l.id}`}
                      className={cn("flex items-center gap-4 rounded-2xl border px-4 py-3 transition hover:border-primary", l.isNext ? "border-primary/40 bg-primary-faint" : "border-transparent bg-page/60")}
                    >
                      <div className="w-16 shrink-0">
                        <div className="text-sm font-bold">{formatTime(l.startsAt, locale)}</div>
                        <div className="text-xs text-muted">{l.durationMin} min</div>
                      </div>
                      {theory ? (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-theory-soft text-theory-ink"><BookOpen className="h-4 w-4" aria-hidden /></span>
                      ) : (
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold", l.isNext ? "bg-primary text-white" : "bg-primary-soft text-primary")}>{l.initials}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate font-bold">{l.name}{l.gearbox === "AUTOMATIC" && !theory && <span className="rounded bg-primary px-1 py-px"><AutBadge /></span>}</div>
                        <div className="truncate text-xs text-muted">{meta}</div>
                      </div>
                      <Badge tone={theory ? "theory" : l.type === "EXAM" ? "navy" : "blue"}>{theory ? td("legendTheory") : td("legendPractical")}</Badge>
                      <span className={cn("w-28 text-right text-sm font-bold", l.isNext ? "text-primary" : needsCheck ? "text-warn-ink" : "text-muted")}>
                        {l.status === "COMPLETED" ? td("done") : l.status === "NO_SHOW" ? td("noShow") : needsCheck ? td("toCheck") : l.isNext ? td("nextUp") : td("upcoming")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader title={td("upcomingExams")} />
            {d.exams.length === 0 ? <p className="text-sm text-muted">{td("noExams")}</p> : (
              <ul className="space-y-4">
                {d.exams.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-4">
                    <div className={cn("flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl", i === 0 ? "bg-exam text-white" : "bg-primary-soft text-primary")}>
                      <span className="text-[10px] font-bold uppercase">{new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { month: "short", timeZone: "Europe/Amsterdam" }).format(e.at).replace(".", "")}</span>
                      <span className="text-lg font-bold leading-none">{new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "Europe/Amsterdam" }).format(e.at)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{e.name}</div>
                      <div className="text-xs text-muted">{e.kind === "PRACTICAL" ? td("practicalExam") : e.kind === "THEORY" ? td("theoryExam") : td("ttExam")} · {formatTime(e.at, locale)}{e.location ? ` · ${e.location}` : ""}</div>
                    </div>
                    {e.kind === "PRACTICAL" && <Badge tone={e.readiness === "READY" ? "blue" : "amber"}>{e.readiness === "READY" ? td("ready") : td("lessonsLeft", { n: e.lessonsLeft ?? 0 })}</Badge>}
                    {e.kind === "THEORY" && <Badge tone="blue">{formatDateShort(e.at, locale)}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-warn-ink/20 bg-warn-soft/40 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-5 w-5 text-warn-ink" aria-hidden />{td("runningLow")}</h2>
            {d.lowHours.length === 0 ? <p className="text-sm text-muted">{td("nobodyLow")}</p> : (
              <ul className="space-y-3">
                {d.lowHours.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <div>
                      <Link href={`/leerlingen?id=${s.id}`} className="font-bold">{s.name}</Link>
                      <div className="text-xs font-bold text-warn-ink">
                        {s.planned > 0 ? td("lowLine", { hours: formatHours(s.minutesAvailable, locale), n: s.planned }) : td("lowLineNone", { hours: formatHours(s.minutesAvailable, locale) })}
                      </div>
                    </div>
                    {isAdmin && <TopUpButton studentId={s.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {d.checkOffTotal > 0 && (
            <Card className="p-6">
              <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><ClipboardCheck className="h-5 w-5 text-primary" aria-hidden />{td("checkOffTitle")}</h2>
              <p className="mb-3 text-sm text-muted">{td("checkOffText", { n: d.checkOffTotal })}</p>
              <Button asChild size="sm"><Link href="/lessen?checkoff=1">{td("checkOffCta")}</Link></Button>
            </Card>
          )}

          {d.apkAlerts.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-3 text-lg font-bold">{td("apkTitle")}</h2>
              <ul className="space-y-2 text-sm font-semibold">
                {d.apkAlerts.map((a) => (
                  <li key={a.id} className={a.state.kind === "overdue" ? "text-danger-ink" : "text-warn-ink"}>
                    {a.state.kind === "overdue" ? td("apkOverdue", { name: a.name, days: a.state.days })
                      : a.state.kind === "today" ? td("apkToday", { name: a.name })
                      : td("apkSoon", { name: a.name, days: "days" in a.state ? a.state.days : 0 })}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
