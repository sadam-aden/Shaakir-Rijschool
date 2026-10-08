"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";

export function UserMenu({ name, role, initials }: { name: string; role: "ADMIN" | "INSTRUCTOR"; initials: string }) {
  const t = useTranslations("user");
  const subtitle = role === "ADMIN" ? `${t("owner")} · ${t("instructor")}` : t("instructor");
  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        aria-label={t("menu")}
        className="flex w-full items-center gap-3 rounded-2xl bg-primary-faint p-3 text-left hover:bg-primary-soft"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-exam text-xs font-bold text-white">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{name}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content side="top" align="start" sideOffset={8} className="z-50 w-60 rounded-2xl border border-line bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-sm font-medium">{t("language")}</span>
            <LanguageSwitcher />
          </div>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-slate-700 hover:bg-page">
              <LogOut className="h-4 w-4" aria-hidden /> {t("signOut")}
            </button>
          </form>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
