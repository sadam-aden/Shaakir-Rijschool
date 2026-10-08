import { getTranslations } from "next-intl/server";

export async function ComingSoon() {
  const t = await getTranslations("pages");
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center text-sm text-muted">
      {t("comingSoon")}
    </div>
  );
}
