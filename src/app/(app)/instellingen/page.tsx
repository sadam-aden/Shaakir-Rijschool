import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/manage/settings-form";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { RunJobsCard } from "@/components/manage/run-jobs";
import { smsProviderName } from "@/lib/providers/sms";
import { getSchoolSettings } from "@/lib/queries/settings";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const t = await getTranslations("settings");
  const tr = await getTranslations("roles");
  const { school, settings } = await getSchoolSettings(user.schoolId);
  const users = await db.user.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true } });
  const sms = smsProviderName();
  const mollie = process.env.MOLLIE_API_KEY ? (process.env.MOLLIE_API_KEY.startsWith("test_") ? "test" : "live") : "mock";
  const integrations = [
    { key: "email", on: !!process.env.RESEND_API_KEY, label: t("integration.connected") },
    { key: "sms", on: sms !== "mock", label: sms === "twilio" ? "Twilio" : sms === "bird" ? "Bird" : t("integration.mock") },
    { key: "mollie", on: mollie !== "mock", label: mollie === "live" ? t("integration.live") : mollie === "test" ? t("integration.test") : t("integration.mock") },
    { key: "ai", on: !!process.env.ANTHROPIC_API_KEY, label: t("integration.connected") },
  ] as const;

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SettingsForm
          settings={settings}
          school={{
            name: school.name, address: school.address ?? "", postcode: school.postcode ?? "", city: school.city ?? "",
            kvk: school.kvk ?? "", btw: school.btw ?? "", iban: school.iban ?? "", defaultLocale: school.defaultLocale,
          }}
        />
        <div className="space-y-6">
          <Card className="space-y-3 p-6">
            <h2 className="text-lg font-bold">{t("integrations")}</h2>
            {integrations.map((i) => (
              <div key={i.key} className="flex items-center justify-between text-sm">
                <span>{t(`integration.${i.key}`)}</span>
                <Badge tone={i.on ? "green" : "grey"}>{i.label}</Badge>
              </div>
            ))}
          </Card>
          <RunJobsCard />
          <Card className="space-y-3 p-6">
            <h2 className="text-lg font-bold">{t("users")}</h2>
            <ul className="space-y-2 text-sm">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
                  <span><span className="font-semibold">{u.name}</span><span className="block text-xs text-muted">{u.email}</span></span>
                  <Badge tone={u.isActive ? "blue" : "grey"}>{tr(u.role)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
