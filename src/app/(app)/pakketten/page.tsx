import { getLocale, getTranslations } from "next-intl/server";
import { PackageDialog } from "@/components/manage/package-form";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { formatHours, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function PackagesPage() {
  const user = await requireAdmin();
  const t = await getTranslations("packages");
  const locale = (await getLocale()) as AppLocale;
  const packages = await db.package.findMany({ where: { schoolId: user.schoolId }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { purchases: true } } } });

  return (
    <>
      <PageHeader title={t("title")} actions={<PackageDialog />} />
      <p className="mb-4 text-sm text-muted">{t("editNote")}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((p) => (
          <Card
            key={p.id}
            className={cn("space-y-3 p-5", p.isPopular && "border-primary/50 bg-primary-faint", p.type === "THEORY" && "bg-warn-soft/40", !p.active && "opacity-60")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{locale === "nl" ? p.nameNl : p.nameEn}</h2>
                <p className="text-sm text-muted">
                  {(locale === "nl" ? p.descriptionNl : p.descriptionEn) ?? t("perLesson", { n: p.lessonCount, hours: formatHours(p.minutesIncluded, locale) })}
                </p>
              </div>
              <div className="text-xl font-bold">{formatMoney(p.priceCents, locale)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{t(`types.${p.type}`)}</Badge>
              {p.includesExam && <Badge tone="navy">{t("includesExam")}</Badge>}
              {p.isPopular && <Badge tone="amber">{t("popular")}</Badge>}
              {!p.active && <Badge tone="grey">{t("inactive")}</Badge>}
              <span className="ml-auto"><PackageDialog id={p.id} initial={{
                nameNl: p.nameNl, nameEn: p.nameEn, descriptionNl: p.descriptionNl ?? "", descriptionEn: p.descriptionEn ?? "", type: p.type,
                lessonCount: p.lessonCount, priceEuros: p.priceCents / 100, vatRate: p.vatRate, includesExam: p.includesExam, isPopular: p.isPopular, active: p.active, sortOrder: p.sortOrder,
              }} /></span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
