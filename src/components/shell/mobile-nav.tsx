"use client";

import * as D from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

/** Top bar with a hamburger below `lg`; the menu opens as a slide-in drawer and closes on navigation. */
export function MobileNav({ schoolName, children }: { schoolName: string; children: ReactNode }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) { setSeen(pathname); setOpen(false); } // close the drawer after navigating
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-card px-4 py-3 lg:hidden">
        <D.Trigger aria-label={t("openMenu")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line hover:bg-primary-faint">
          <Menu className="h-5 w-5" aria-hidden />
        </D.Trigger>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">SR</div>
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{schoolName || "RijSchool Planner"}</span>
      </div>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
        <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[300px] flex-col bg-card p-5 shadow-xl outline-none lg:hidden">
          <D.Title className="sr-only">{t("menu")}</D.Title>
          <D.Description className="sr-only">{t("menu")}</D.Description>
          <D.Close aria-label={t("closeMenu")} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl hover:bg-page">
            <X className="h-5 w-5" aria-hidden />
          </D.Close>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
