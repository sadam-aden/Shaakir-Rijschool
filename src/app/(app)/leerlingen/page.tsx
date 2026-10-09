import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { StudentActions } from "@/components/students/student-actions";
import { StudentDetailPanel } from "@/components/students/detail-panel";
import { StudentFormDialog } from "@/components/students/student-form";
import { StudentTable } from "@/components/students/student-table";
import { Card, EmptyState } from "@/components/ui/card";
import { requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { filterStudents, getStudentDetail, getStudentRows, paymentSummary, type StudentFilter } from "@/lib/queries/students";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const FILTERS: StudentFilter[] = ["all", "practical", "theoryOnly", "examSoon", "lowHours", "manual", "automatic", "waiting", "archived"];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; id?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations("students");
  const filter = (FILTERS as string[]).includes(sp.filter ?? "") ? (sp.filter as StudentFilter) : "all";
  const q = sp.q ?? "";

  const { rows, lowHoursMinutes } = await getStudentRows(user);
  const { list, counts } = filterStudents(rows, filter, q, lowHoursMinutes);
  const selectedId = list.find((r) => r.id === sp.id)?.id ?? list[0]?.id;
  const selected = selectedId ? await getStudentDetail(user, selectedId) : null;
  const instructors = user.role === "ADMIN" ? await db.instructor.findMany({ where: { schoolId: user.schoolId, active: true }, select: { id: true, displayName: true } }) : [];

  const href = (over: { filter?: string; id?: string }) => {
    const p = new URLSearchParams();
    const f = over.filter ?? filter;
    if (f !== "all") p.set("filter", f);
    if (q) p.set("q", q);
    if (over.id) p.set("id", over.id);
    const s = p.toString();
    return `/leerlingen${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        hideSearch
        title={user.role === "ADMIN" ? t("title") : t("myTitle")}
        eyebrow={t("headerCounts", { active: counts.all, waiting: counts.waiting })}
        actions={
          <>
            <form action="/leerlingen" className="relative hidden lg:block">
              {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                name="q" defaultValue={q} placeholder={t("search")} aria-label={t("search")}
                className="w-64 rounded-xl border border-line bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </form>
            <StudentFormDialog
              mode="create" instructors={instructors} isAdmin={user.role === "ADMIN"}
              trigger={<Button variant="soft"><Plus className="h-4 w-4" aria-hidden />{t("add")}</Button>}
            />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b border-line p-4">
            {FILTERS.filter((f) => f !== "manual" && f !== "automatic").map((f) => (
              <Link
                key={f} href={href({ filter: f })} scroll={false}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-sm font-semibold",
                  filter === f
                    ? "border-exam bg-exam text-white"
                    : f === "lowHours"
                      ? "border-theory/50 bg-warn-soft text-warn-ink"
                      : "border-line bg-card hover:bg-primary-faint",
                )}
              >
                {t(`filters.${f}`)} · {counts[f]}
              </Link>
            ))}
            <span className="ml-auto flex rounded-xl border border-line p-0.5 text-sm font-semibold">
              {(["manual", "automatic"] as const).map((f) => (
                <Link
                  key={f} href={href({ filter: f })} scroll={false}
                  className={cn("rounded-lg px-3 py-1", filter === f ? "bg-exam text-white" : f === "automatic" ? "text-success-ink" : "")}
                >
                  {t(`filters.${f}`)} · {counts[f]}
                </Link>
              ))}
            </span>
          </div>
          {list.length === 0 ? (
            <div className="p-6"><EmptyState>{t("empty")}</EmptyState></div>
          ) : (
            <StudentTable rows={list} selectedId={selectedId} hrefFor={(id) => href({ id })} lowHoursMinutes={lowHoursMinutes} />
          )}
        </Card>
        {selected && (
          <Card key={selected.id} className="h-fit p-6 xl:sticky xl:top-8">
            <StudentDetailPanel student={selected} payment={paymentSummary(user, selected.packages)} profileLink actions={<StudentActions student={selected} user={user} />} />
          </Card>
        )}
      </div>
    </>
  );
}
