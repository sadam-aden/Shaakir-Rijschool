import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LessonSheetLoader } from "@/components/lessons/lesson-sheet-loader";
import { LessonTable, type LessonRow } from "@/components/lessons/lesson-table";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { getLessonList } from "@/lib/queries/lessons";

type SP = { status?: string; type?: string; instructor?: string; from?: string; to?: string; checkoff?: string; page?: string; lesson?: string };

export default async function LessonsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations("lessons");
  const ts = await getTranslations("lessonStatus");
  const tt = await getTranslations("lessonType");
  const locale = await getLocale();

  const needsCheckOff = sp.checkoff === "1";
  const list = await getLessonList(user, {
    status: sp.status, type: sp.type, instructorId: sp.instructor, from: sp.from, to: sp.to, needsCheckOff, page: Number(sp.page) || 1,
  });
  const instructors = user.role === "ADMIN" ? await db.instructor.findMany({ where: { schoolId: user.schoolId }, select: { id: true, displayName: true } }) : [];

  const keep = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v && k !== "lesson") p.set(k, v);
    return `/lessen?${p}`;
  };
  const rows: LessonRow[] = list.rows.map((l) => ({
    id: l.id, startsAt: l.startsAt.toISOString(), endsAt: l.endsAt.toISOString(), durationMin: l.durationMin, type: l.type, status: l.status,
    student: l.student ? `${l.student.firstName} ${l.student.lastName}` : null, instructor: l.instructor.displayName, car: l.vehicle?.name ?? null,
    title: l.theoryGroup ? (locale === "nl" ? l.theoryGroup.titleNl : l.theoryGroup.titleEn) : null,
    needsCheckOff: l.status === "PLANNED" && l.endsAt < new Date(),
  }));
  const hrefFor = Object.fromEntries(rows.map((r) => [r.id, keep({ lesson: r.id })]));

  return (
    <>
      <PageHeader title={t("title")} />
      <Card className="overflow-hidden">
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" action="/lessen">
          <label className="flex flex-col text-xs font-bold text-muted">{t("filters.status")}
            <Select name="status" defaultValue={sp.status ?? "all"} className="mt-1 w-44 py-2">
              <option value="all">{t("filters.all")}</option>
              {(["PLANNED", "COMPLETED", "NO_SHOW", "CANCELLED_STUDENT", "CANCELLED_SCHOOL", "DRAFT"] as const).map((s) => <option key={s} value={s}>{ts(s)}</option>)}
            </Select>
          </label>
          <label className="flex flex-col text-xs font-bold text-muted">{t("filters.type")}
            <Select name="type" defaultValue={sp.type ?? "all"} className="mt-1 w-36 py-2">
              <option value="all">{t("filters.all")}</option>
              {(["PRACTICAL", "THEORY", "EXAM"] as const).map((s) => <option key={s} value={s}>{tt(s)}</option>)}
            </Select>
          </label>
          {user.role === "ADMIN" && (
            <label className="flex flex-col text-xs font-bold text-muted">{t("filters.instructor")}
              <Select name="instructor" defaultValue={sp.instructor ?? ""} className="mt-1 w-40 py-2">
                <option value="">{t("filters.all")}</option>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.displayName}</option>)}
              </Select>
            </label>
          )}
          <label className="flex flex-col text-xs font-bold text-muted">{t("filters.from")}<Input type="date" name="from" defaultValue={sp.from} className="mt-1 py-2" /></label>
          <label className="flex flex-col text-xs font-bold text-muted">{t("filters.to")}<Input type="date" name="to" defaultValue={sp.to} className="mt-1 py-2" /></label>
          <label className="flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" name="checkoff" value="1" defaultChecked={needsCheckOff} /> {t("filters.needsCheckOff")}</label>
          <Button type="submit" variant="soft">{t("filters.apply")}</Button>
          <Button asChild variant="ghost"><Link href="/lessen">{t("filters.reset")}</Link></Button>
        </form>
        {rows.length === 0 ? <div className="p-6"><EmptyState>{t("empty")}</EmptyState></div> : <LessonTable rows={rows} hrefFor={hrefFor} showCheckOff />}
        {list.pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-muted">{list.page} / {list.pages}</span>
            <div className="flex gap-2">
              {list.page > 1 && <Button asChild variant="outline" size="sm"><Link href={keep({ page: String(list.page - 1) })}>←</Link></Button>}
              {list.page < list.pages && <Button asChild variant="outline" size="sm"><Link href={keep({ page: String(list.page + 1) })}>→</Link></Button>}
            </div>
          </div>
        )}
      </Card>
      {sp.lesson && <LessonSheetLoader user={user} id={sp.lesson} />}
    </>
  );
}
