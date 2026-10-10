import { Bell, Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { AppLocale } from "@/i18n/config";
import { formatDateLong } from "@/lib/format";
import { isoWeek } from "@/lib/domain/time";
import { getSessionUser } from "@/lib/dal/session";
import { getGenerateOptions } from "@/lib/queries/schedule-options";
import { GenerateScheduleButton } from "@/components/schedule/generate-button";

/**
 * Top bar used by every page: small date/week label above a large title, search,
 * notification bell and the primary "Generate schedule" button (wired up in Phase 3).
 */
export async function PageHeader({ title, eyebrow, actions, hideSearch }: { title: string; eyebrow?: ReactNode; actions?: ReactNode; hideSearch?: boolean }) {
  const t = await getTranslations("topbar");
  const locale = (await getLocale()) as AppLocale;
  const now = new Date();
  const user = await getSessionUser();
  const gen = user ? await getGenerateOptions(user) : null;
  const label = eyebrow ?? `${formatDateLong(now, locale)} · ${t("week", { week: isoWeek(now).week })}`;
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-muted first-letter:uppercase">{label}</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {!hideSearch && (
        <label className="relative hidden md:block">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder={t("search")}
            className="w-72 rounded-xl border border-line bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        )}
        <button aria-label={t("notifications")} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card hover:bg-primary-faint">
          <Bell className="h-4 w-4" aria-hidden />
        </button>
        {user && gen && gen.instructors.length > 0 && (
          <GenerateScheduleButton instructors={gen.instructors} defaultInstructorId={gen.defaultInstructorId} isAdmin={user.role === "ADMIN"} />
        )}
      </div>
    </header>
  );
}
