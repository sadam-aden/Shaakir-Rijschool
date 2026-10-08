import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getTheme } from "@/lib/theme-server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const t = await getTranslations("login");
  const theme = await getTheme();
  const school = await db.school.findFirst({ select: { name: true } }).catch(() => null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">SR</div>
          <div className="flex gap-2">
            <ThemeSwitcher initial={theme} />
            <LanguageSwitcher />
          </div>
        </div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">{t("subtitle", { school: school?.name ?? "RijSchool Planner" })}</p>
        <LoginForm />
      </div>
    </main>
  );
}
