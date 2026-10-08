import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { AcceptForm } from "./accept-form";

export default async function InvitePage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ name?: string }> }) {
  const { token } = await params;
  const { name } = await searchParams;
  const t = await getTranslations("invite");
  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">SR</div>
          <LanguageSwitcher />
        </div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {valid ? (
          <>
            <p className="mb-6 mt-1 text-sm text-muted">{invite.email}</p>
            <AcceptForm token={token} defaultName={name ?? ""} />
          </>
        ) : (
          <p role="alert" className="mt-4 text-sm text-danger-ink">{t("expired")}</p>
        )}
      </div>
    </main>
  );
}
