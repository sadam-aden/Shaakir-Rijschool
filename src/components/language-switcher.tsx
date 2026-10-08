"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label={t(locale === "nl" ? "nl" : "en")} className={cn("inline-flex rounded-lg bg-page p-0.5", className)}>
      {(["nl", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={locale === l}
          title={t(l)}
          onClick={() => start(async () => { await setLocaleAction(l); router.refresh(); })}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition",
            locale === l ? "bg-white text-primary shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
