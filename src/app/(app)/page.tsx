import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { requireUser } from "@/lib/dal/session";
import { greetingKey } from "@/lib/domain/time";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations();
  const firstName = user.name.split(" ")[0];
  return (
    <>
      <PageHeader title={t(`greeting.${greetingKey(new Date())}`, { name: firstName })} />
      <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center text-sm text-muted">
        {t("pages.dashboardPhase")}
      </div>
    </>
  );
}
