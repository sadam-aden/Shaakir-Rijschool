"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, requestMagicLinkAction } from "@/app/actions/auth";

const input =
  "mt-1 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [magic, magicAction, magicPending] = useActionState(requestMagicLinkAction, undefined);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <label className="block text-sm font-medium">
          {t("email")}
          <input name="email" type="email" required autoComplete="email" defaultValue={state?.email ?? ""} className={input} />
        </label>
        <label className="block text-sm font-medium">
          {t("password")}
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        {state?.error && (
          <p role="alert" className="text-sm text-danger-ink">
            {t(state.error === "tooMany" ? "tooMany" : "invalid")}
          </p>
        )}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 disabled:opacity-60"
        >
          {t("submit")}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> {t("or")} <span className="h-px flex-1 bg-line" />
      </div>

      <form action={magicAction} className="space-y-3">
        <input name="email" type="email" required placeholder={t("email")} aria-label={t("email")} className={input} />
        <button
          disabled={magicPending}
          className="w-full rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary-faint disabled:opacity-60"
        >
          {t("magicLink")}
        </button>
        {magic?.magicSent && <p role="status" className="text-sm text-success-ink">{t("magicLinkSent")}</p>}
        {magic?.error && <p role="alert" className="text-sm text-danger-ink">{t(magic.error === "tooMany" ? "tooMany" : "invalid")}</p>}
      </form>
    </div>
  );
}
