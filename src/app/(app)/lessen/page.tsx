import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";
import { requireUser } from "@/lib/dal/session";

export default async function Page() {
  await requireUser();
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("lessons")} />
      <ComingSoon />
    </>
  );
}
