import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/dal/session";
import { lessonScope } from "@/lib/dal/scope";
import { revenueByMonth } from "@/lib/domain/money";
import { localDateKey, startOfIsoWeek } from "@/lib/domain/time";

const DAY = 86_400_000;

/** Data for the three dashboard charts: this week per day, lesson outcomes (30 days) and revenue (admin only). */
export async function getDashboardCharts(user: SessionUser) {
  const now = new Date();
  const weekStart = startOfIsoWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  const since = new Date(now.getTime() - 30 * DAY);
  const isAdmin = user.role === "ADMIN";

  const [week, outcomes, payments] = await Promise.all([
    db.lesson.findMany({
      where: { ...lessonScope(user), status: { in: ["PLANNED", "COMPLETED", "NO_SHOW"] }, startsAt: { gte: weekStart, lt: weekEnd } },
      select: { startsAt: true, durationMin: true, type: true },
    }),
    db.lesson.groupBy({
      by: ["status"],
      where: { ...lessonScope(user), status: { in: ["COMPLETED", "NO_SHOW", "CANCELLED_STUDENT", "CANCELLED_SCHOOL"] }, startsAt: { gte: since, lt: now } },
      _count: true,
    }),
    isAdmin
      ? db.payment.findMany({ where: { schoolId: user.schoolId, status: "PAID", paidAt: { gte: new Date(now.getTime() - 200 * DAY) } }, select: { paidAt: true, amountCents: true } })
      : Promise.resolve([]),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const key = localDateKey(new Date(weekStart.getTime() + i * DAY + 12 * 3_600_000));
    const of = week.filter((l) => localDateKey(l.startsAt) === key);
    const sum = (theory: boolean) => of.filter((l) => (l.type === "THEORY") === theory).reduce((a, l) => a + l.durationMin, 0);
    return { key, practicalMin: sum(false), theoryMin: sum(true), today: key === localDateKey(now) };
  });

  const count = (...s: string[]) => outcomes.filter((o) => s.includes(o.status)).reduce((a, o) => a + o._count, 0);
  return {
    days,
    outcomes: { completed: count("COMPLETED"), noShow: count("NO_SHOW"), cancelled: count("CANCELLED_STUDENT", "CANCELLED_SCHOOL") },
    revenue: isAdmin
      ? revenueByMonth(payments.filter((p) => p.paidAt).map((p) => ({ paidAt: p.paidAt!, amountCents: p.amountCents })), now, 6, (d) => localDateKey(d).slice(0, 7))
      : null,
  };
}
