import { ArrowLeft, CalendarPlus, Pencil } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { StudentDetailPanel } from "@/components/students/detail-panel";
import { StudentFormDialog } from "@/components/students/student-form";
import { AddPackageDialog, AdjustHoursDialog, ExamDialog, UnavailabilityManager } from "@/components/students/profile-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/config";
import { lessonScope } from "@/lib/dal/scope";
import { requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { formatDateLong, formatHours, formatMoney, formatTime } from "@/lib/format";
import { getStudentDetail, paymentSummary } from "@/lib/queries/students";
import { cn } from "@/lib/utils";

const TABS = ["lessons", "payments", "exams", "notes"] as const;
const tone = { PLANNED: "blue", DRAFT: "grey", COMPLETED: "green", NO_SHOW: "amber", CANCELLED_STUDENT: "grey", CANCELLED_SCHOOL: "grey" } as const;

export default async function StudentProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations("students");
  const tl = await getTranslations("lessonStatus");
  const tt = await getTranslations("lessonType");
  const locale = (await getLocale()) as AppLocale;
  const isAdmin = user.role === "ADMIN";

  const student = await getStudentDetail(user, id);
  const allowed = TABS.filter((x) => isAdmin || x !== "payments");
  const tab = (allowed as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "lessons";
  const payment = paymentSummary(user, student.packages);

  const lessons = await db.lesson.findMany({
    where: { ...lessonScope(user), studentId: id },
    orderBy: { startsAt: "desc" },
    take: 100,
    include: { instructor: { select: { displayName: true } } },
  });
  const [instructors, packages, ledger] = await Promise.all([
    isAdmin ? db.instructor.findMany({ where: { schoolId: user.schoolId, active: true }, select: { id: true, displayName: true } }) : [],
    isAdmin ? db.package.findMany({ where: { schoolId: user.schoolId, active: true }, orderBy: { sortOrder: "asc" } }) : [],
    isAdmin ? db.hoursLedgerEntry.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" }, take: 50 }) : [],
  ]);

  const form = {
    firstName: student.firstName, lastName: student.lastName, phone: student.phone ?? "", email: student.email ?? "",
    birthDate: student.birthDate ? student.birthDate.toISOString().slice(0, 10) : "", address: student.address ?? "",
    postcode: student.postcode ?? "", area: student.area ?? "", gearbox: student.gearbox, track: student.track, status: student.status,
    primaryInstructorId: student.primaryInstructorId ?? "", locale: student.locale, smsConsent: student.smsConsent,
    emailConsent: student.emailConsent, cbrCandidateNumber: student.cbrCandidateNumber ?? "", guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? "", guardianEmail: student.guardianEmail ?? "", notes: student.notes ?? "",
  };
  const toLocalInput = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        eyebrow={<Link href="/leerlingen" className="inline-flex items-center gap-1 text-primary"><ArrowLeft className="h-3.5 w-3.5" />{t("title")}</Link>}
        actions={
          <>
            <StudentFormDialog
              mode="edit" studentId={id} initial={form} instructors={instructors} isAdmin={isAdmin}
              trigger={<Button variant="outline"><Pencil className="h-4 w-4" aria-hidden />{t("detail.edit")}</Button>}
            />
            <Button asChild><Link href={`/les-inplannen?student=${id}`}><CalendarPlus className="h-4 w-4" aria-hidden />{t("panel.bookLesson")}</Link></Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit p-6"><StudentDetailPanel student={student} payment={payment} /></Card>
        <div className="space-y-4">
          <nav className="flex gap-2" aria-label="Tabs">
            {allowed.map((x) => (
              <Link key={x} href={`/leerlingen/${id}?tab=${x}`} aria-current={tab === x ? "page" : undefined}
                className={cn("rounded-xl border px-4 py-2 text-sm font-semibold", tab === x ? "border-exam bg-exam text-white" : "border-line bg-card hover:bg-primary-faint")}>
                {t(`detail.tabs.${x}`)}
              </Link>
            ))}
          </nav>

          {tab === "lessons" && (
            <Card className="overflow-hidden">
              {lessons.length === 0 ? <div className="p-6"><EmptyState>{t("detail.noLessons")}</EmptyState></div> : (
                <ul>
                  {lessons.map((l) => (
                    <li key={l.id} className="border-b border-line last:border-b-0">
                      <Link href={`/lessen?lesson=${l.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-primary-faint">
                        <div className="w-44 text-sm font-bold">{formatDateLong(l.startsAt, locale)}</div>
                        <div className="w-24 text-sm">{formatTime(l.startsAt, locale)} · {l.durationMin} min</div>
                        <div className="flex-1 text-sm text-muted">{tt(l.type)} · {l.instructor.displayName}</div>
                        <Badge tone={tone[l.status]}>{tl(l.status)}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === "payments" && isAdmin && (
            <>
              <Card className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t("detail.package")}</h2>
                  <div className="flex gap-2">
                    <AdjustHoursDialog studentId={id} />
                    <AddPackageDialog studentId={id} packages={packages.map((p) => ({ id: p.id, name: locale === "nl" ? p.nameNl : p.nameEn }))} />
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  {student.packages.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
                      <span className="font-semibold">{locale === "nl" ? p.package.nameNl : p.package.nameEn}</span>
                      <span className="text-muted">{formatHours(p.minutesPurchased, locale)} · {formatMoney(p.priceCents, locale)}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-sm">
                  <Badge tone={payment.state === "PAID" ? "green" : payment.state === "NONE" ? "grey" : "amber"}>{t(`detail.paidStatus.${payment.state}`)}</Badge>
                  {payment.totalCents !== undefined && payment.paidCents !== undefined && payment.state !== "NONE" && (
                    <span className="ml-3 text-muted">{formatMoney(payment.paidCents, locale)} / {formatMoney(payment.totalCents, locale)}</span>
                  )}
                </div>
              </Card>
              <Card className="p-6">
                <h2 className="mb-3 text-lg font-bold">{t("detail.ledger")}</h2>
                <ul className="divide-y divide-line text-sm">
                  {ledger.map((e) => (
                    <li key={e.id} className="flex items-center justify-between py-2">
                      <span><span className="font-semibold">{t(`detail.ledgerTypes.${e.type}`)}</span>{e.note ? <span className="text-muted"> · {e.note}</span> : null}</span>
                      <span className="flex items-center gap-4"><span className="text-xs text-muted">{formatDateLong(e.createdAt, locale)}</span><span className={e.minutes < 0 ? "font-bold" : "font-bold text-success-ink"}>{e.minutes > 0 ? "+" : ""}{e.minutes} min</span></span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          {tab === "exams" && (
            <Card className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{t("detail.tabs.exams")}</h2>
                <ExamDialog studentId={id} />
              </div>
              {student.exams.length === 0 ? <EmptyState>{t("detail.noExams")}</EmptyState> : (
                <ul className="space-y-2">
                  {student.exams.map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded-xl bg-page px-4 py-3 text-sm">
                      <div>
                        <div className="font-bold">{t(`detail.examKind.${e.kind}`)} <span className="font-normal text-muted">· {t("detail.attempt", { n: e.attemptNumber })}</span></div>
                        <div className="text-muted">{e.scheduledAt ? `${formatDateLong(e.scheduledAt, locale)} ${formatTime(e.scheduledAt, locale)}` : "—"}{e.cbrLocation ? ` · ${e.cbrLocation}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={e.status === "PASSED" ? "green" : e.status === "FAILED" ? "red" : e.status === "REQUESTED" ? "navy" : "blue"}>{t(`detail.examStatus.${e.status}`)}</Badge>
                        <ExamDialog studentId={id} exam={{ id: e.id, kind: e.kind, status: e.status, scheduledAt: toLocalInput(e.scheduledAt), cbrLocation: e.cbrLocation ?? "", notes: e.notes ?? "" }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === "notes" && (
            <Card className="space-y-6 p-6">
              <div>
                <h2 className="mb-2 text-lg font-bold">{t("detail.tabs.notes")}</h2>
                <p className="whitespace-pre-wrap text-sm text-muted">{student.notes || "—"}</p>
              </div>
              <UnavailabilityManager
                studentId={id}
                items={student.unavailability.map((u) => ({ id: u.id, startsAt: u.startsAt.toISOString(), endsAt: u.endsAt.toISOString(), reason: u.reason }))}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
