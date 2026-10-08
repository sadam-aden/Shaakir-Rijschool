"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { acceptInviteAction } from "@/app/actions/invites";

const input =
  "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AcceptForm({ token, defaultName }: { token: string; defaultName: string }) {
  const t = useTranslations("invite");
  const [state, action, pending] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm font-medium">
        {t("name")}
        <input name="name" required defaultValue={defaultName} autoComplete="name" className={input} />
      </label>
      <label className="block text-sm font-medium">
        {t("password")}
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={input} />
        <span className="mt-1 block text-xs text-muted">{t("passwordHint")}</span>
      </label>
      {state?.error && <p role="alert" className="text-sm text-danger-ink">{t(state.error === "expired" ? "expired" : "invalid")}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
