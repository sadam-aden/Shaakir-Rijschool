"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { BarChart3, CalendarDays, CalendarPlus, Car, ClipboardList, LayoutGrid, Package, Receipt, Settings, UserCog, Users } from "lucide-react";
import type { IconKey, NavItem } from "./nav";

const icons = { dashboard: LayoutGrid, calendar: CalendarDays, students: Users, book: CalendarPlus, lessons: ClipboardList, payments: Receipt, reports: BarChart3, instructors: UserCog, vehicles: Car, packages: Package, settings: Settings } satisfies Record<IconKey, unknown>;

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map(({ href, labelKey, icon }) => {
        const Icon = icons[icon];
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                active ? "bg-primary-soft text-primary" : "text-slate-600 hover:bg-page hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {t(labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
