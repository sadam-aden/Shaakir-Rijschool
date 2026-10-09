import { CalendarPlus, Mail } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Avatar, initialsOf } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProgressBar, Ring } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/config";
import { formatDateShort, formatNumber } from "@/lib/format";
import type { getStudentDetail, paymentSummary } from "@/lib/queries/students";
import { AvailabilityGrid } from "./availability-grid";
import { GearboxToggle } from "./gearbox-toggle";

type Detail = Awaited<ReturnType<typeof getStudentDetail>>;
type Payment = ReturnType<typeof paymentSummary>;

/** Right-hand panel on /leerlingen (matches mockup 3) and the overview block on the profile page. */
export async function StudentDetailPanel({ student, payment, profileLink, actions }: { student: Detail; payment: Payment; profileLink?: boolean; actions?: React.ReactNode }) {
  const t = await getTranslations("students.panel");
  const locale = (await getLocale()) as AppLocale;

  const purchased = student.packages.filter((p) => p.status === "ACTIVE").reduce((a, p) => a + p.minutesPurchased, 0);
  const left = student.minutesRemaining;
  const lessons = Math.round(purchased / 60);
  const paymentText =
    payment.state === "PAID" ? t("paidFull") : payment.state === "PARTIAL" ? t("partial") : payment.state === "UNPAID" ? t("unpaid") : null;

  const theory = student.exams.find((e) => e.kind === "THEORY" && e.status !== "CANCELLED");
  const practical = student.exams.find((e) => e.kind === "PRACTICAL" && e.status !== "CANCELLED");
  const examText = (e: typeof theory) => {
    if (!e) return t("notPlanned");
    if (e.status === "PASSED") return t("passedOn", { date: e.scheduledAt ? formatDateShort(e.scheduledAt, locale) : "" });
    if (e.status === "REQUESTED") return t("requested");
    return e.scheduledAt ? t("scheduledOn", { date: formatDateShort(e.scheduledAt, locale) }) : t("notPlanned");
  };

  const skills = student.skillProgress.sort((a, b) => a.skill.sortOrder - b.skill.sortOrder);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar initials={initialsOf(student.firstName, student.lastName)} solid size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{student.firstName} {student.lastName}</h2>
          <p className="text-sm text-muted">
            {t("since", { date: new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { month: "long", year: "numeric" }).format(student.since) })}
            {student.area ? ` · ${student.area}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="whitespace-nowrap px-3">
          <Link href={`/les-inplannen?student=${student.id}`}><CalendarPlus className="h-4 w-4" aria-hidden />{t("bookLesson")}</Link>
        </Button>
        <Button asChild variant="outline" className="whitespace-nowrap px-3">
          <a href={student.email ? `mailto:${student.email}` : student.phone ? `tel:${student.phone}` : undefined} aria-disabled={!student.email && !student.phone}>
            <Mail className="h-4 w-4" aria-hidden />{t("message")}
          </a>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{t("learnsIn")}</span>
        <GearboxToggle key={student.id} studentId={student.id} initial={student.gearbox} />
      </div>

      <div className="flex items-center gap-4 rounded-2xl bg-primary-faint p-4">
        <Ring value={left} max={purchased || left || 1} label={formatNumber(left / 60, locale, 1)} />
        <div>
          <div className="text-xs font-semibold text-muted">{t("remainingHours")}</div>
          <div className="font-bold">{t("hoursLeft", { left: formatNumber(left / 60, locale, 1), total: formatNumber(purchased / 60, locale, 1) })}</div>
          <div className="text-xs text-muted">
            {lessons > 0 ? t("packageSummary", { n: lessons, payment: paymentText ?? "" }).replace(/ · $/, "") : t("noPackage")}
          </div>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-bold">{t("weeklyAvailability")}</h3>
        <AvailabilityGrid
          key={student.id}
          studentId={student.id}
          initial={student.availability.map((a) => ({ weekday: a.weekday, part: a.part, startMin: a.startMin, endMin: a.endMin }))}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold">{t("skills")}</h3>
        {skills.length === 0 ? (
          <p className="text-sm text-muted">{t("noSkills")}</p>
        ) : (
          <ul className="space-y-3">
            {skills.map((s) => (
              <li key={s.id}>
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span>{locale === "nl" ? s.skill.nameNl : s.skill.nameEn}</span>
                  <span>{s.value}%</span>
                </div>
                <ProgressBar value={s.value} max={100} tone={s.value < 50 ? "amber" : "blue"} label={s.skill.nameEn} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{t("theoryExam")}</dt><dd className={theory?.status === "PASSED" ? "font-bold text-primary" : "font-bold"}>{examText(theory)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">{t("practicalExam")}</dt><dd className="font-bold">{examText(practical)}</dd></div>
      </dl>

      {profileLink && (
        <Button asChild variant="soft" className="w-full">
          <Link href={`/leerlingen/${student.id}`}>{t("openProfile")}</Link>
        </Button>
      )}
      {actions}
    </div>
  );
}
