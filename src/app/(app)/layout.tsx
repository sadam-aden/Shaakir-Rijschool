import { Sidebar } from "@/components/shell/sidebar";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const school = await db.school.findUnique({ where: { id: user.schoolId }, select: { name: true } });
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} schoolName={school?.name ?? ""} />
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
