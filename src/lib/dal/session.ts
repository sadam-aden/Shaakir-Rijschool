import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  role: "ADMIN" | "INSTRUCTOR";
  schoolId: string;
  instructorId: string | null;
  name: string;
  locale: "nl" | "en";
};

/** Current user, re-read from the database so deactivation takes effect immediately. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, schoolId: true, name: true, locale: true, isActive: true, instructor: { select: { id: true } } },
  });
  if (!u || !u.isActive) return null;
  return { id: u.id, role: u.role, schoolId: u.schoolId, instructorId: u.instructor?.id ?? null, name: u.name, locale: u.locale };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages and server actions that only the owner/admin may use (payments, reports, settings…). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
