import { getTranslations } from "next-intl/server";
import { mainNav, manageNav } from "./nav";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import type { SessionUser } from "@/lib/dal/session";

export async function Sidebar({ user, schoolName }: { user: SessionUser; schoolName: string }) {
  const t = await getTranslations("nav");
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <aside className="sticky top-0 hidden h-screen w-[230px] shrink-0 flex-col border-r border-line bg-white p-5 lg:flex">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">SR</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight">RijSchool Planner</div>
          <div className="truncate text-xs text-muted">{schoolName}</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto" aria-label="Main">
        <SidebarNav items={mainNav(user.role)} />
        {user.role === "ADMIN" && (
          <>
            <div className="mb-2 mt-6 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">{t("manage")}</div>
            <SidebarNav items={manageNav} />
          </>
        )}
      </nav>
      <UserMenu name={user.name} role={user.role} initials={initials} />
    </aside>
  );
}
