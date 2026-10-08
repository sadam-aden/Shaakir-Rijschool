import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findStudentFor } from "@/lib/dal/guards";
import { getSessionUser } from "@/lib/dal/session";
import { loadSlotContext } from "@/lib/dal/slot-context";
import { db } from "@/lib/db";
import { explanationFactors, pickDisplaySlots, rankSlots } from "@/lib/domain/best-fit";
import { localParts } from "@/lib/domain/time";

const query = z.object({
  studentId: z.string().min(1),
  instructorId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.coerce.number().int().min(30).max(240),
  type: z.enum(["PRACTICAL", "EXAM"]).default("PRACTICAL"),
  locale: z.enum(["nl", "en"]).default("nl"),
});

/** Ranked time slots for one day: best fit, other valid times and blocked times with their reason. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const q = parsed.data;

  const instructorId = user.role === "INSTRUCTOR" ? user.instructorId : (q.instructorId ?? user.instructorId);
  const student = await findStudentFor(user, q.studentId);
  if (!instructorId || !student) return NextResponse.json({ error: "notFound" }, { status: 404 });
  if (!(await db.instructor.findFirst({ where: { id: instructorId, schoolId: user.schoolId } }))) return NextResponse.json({ error: "notFound" }, { status: 404 });

  const [y, m, d] = q.date.split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d, -2));
  const ctx = await loadSlotContext({
    schoolId: user.schoolId, instructorId, studentId: student.id,
    from: dayStart, to: new Date(dayStart.getTime() + 28 * 3_600_000), locale: q.locale,
  });
  const ranked = rankSlots(
    ctx,
    {
      type: q.type, gearbox: student.gearbox,
      pickup: student.lat != null && student.lng != null ? { lat: student.lat, lng: student.lng } : null,
    },
    { year: y, month: m, day: d },
    q.duration,
  );
  const vehicles = new Map(ctx.vehicles.map((v) => [v.id, v.name]));
  const slots = pickDisplaySlots(ranked).map((s) => ({
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    minutes: localParts(s.startsAt).minutes,
    ok: s.ok,
    best: s.best,
    conflicts: s.conflicts,
    vehicleId: s.vehicleId,
    vehicleName: s.vehicleId ? vehicles.get(s.vehicleId) : null,
    factors: s.best ? explanationFactors(s) : [],
  }));

  // day overview ("Wednesday at a glance") for the right-hand panel
  const dayItems = ctx.instructor.busy
    .filter((b) => localParts(b.startsAt).day === d && localParts(b.startsAt).month === m)
    .sort((a, b) => +a.startsAt - +b.startsAt)
    .map((b) => ({ id: b.id, kind: b.kind, label: b.label, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString() }));
  const dayMinutes = dayItems.reduce((a, b) => a + Math.round((+new Date(b.endsAt) - +new Date(b.startsAt)) / 60_000), 0);

  return NextResponse.json({
    slots, dayItems, dayMinutes, maxMinutes: ctx.instructor.maxMinutesPerDay,
    studentAvailable: ctx.student?.minutesAvailable ?? 0,
  });
}
