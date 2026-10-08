/**
 * checkSlot — the single conflict checker shared by booking, drag & drop, editing and the scheduler.
 * Pure: callers load a SlotContext (everything relevant for one instructor / student / day range)
 * and get back conflicts, each with a translatable reason key (messages: conflicts.<key>).
 * DB exclusion constraints remain the final guard against races.
 */
import { fitsAvailability, hitsUnavailability, overlaps, type Avail, type Interval } from "./availability";
import { travelMinutes, type LatLng } from "./geo";
import { isoWeekday, localDateKey, localParts, SCHOOL_TZ } from "./time";

export type Gearbox = "MANUAL" | "AUTOMATIC";
export type BusyKind = "LESSON" | "THEORY" | "EXAM";

export type Busy = Interval & { id: string; kind: BusyKind; label: string; lat?: number | null; lng?: number | null };

export type VehicleCtx = {
  id: string;
  name: string;
  gearbox: Gearbox;
  status: "ACTIVE" | "IN_MAINTENANCE" | "RETIRED";
  apkDueDate: Date | null;
  unavailability: Interval[];
  busy: (Interval & { id: string })[];
};

export type SlotContext = {
  tz?: string;
  settings: { travelBufferMin: number; urbanFactor?: number; speedKmh?: number };
  instructor: {
    id: string;
    maxMinutesPerDay: number;
    defaultVehicleId: string | null;
    workingHours: { weekday: number; startMin: number; endMin: number }[];
    timeOff: Interval[];
    busy: Busy[];
  };
  student?: {
    id: string;
    availability: Avail[];
    unavailability: Interval[];
    minutesAvailable: number;
    busy: Busy[];
  };
  vehicles: VehicleCtx[];
};

export type SlotInput = {
  startsAt: Date;
  endsAt: Date;
  type: "PRACTICAL" | "THEORY" | "EXAM";
  gearbox?: Gearbox | null;
  pickup?: LatLng | null;
  /** lesson being moved/edited: ignored when looking for clashes */
  excludeLessonId?: string;
  preferredVehicleId?: string | null;
  /** admin overrides */
  overrides?: { availability?: boolean; hours?: boolean };
};

export type ConflictKey =
  | "outsideWorkingHours"
  | "instructorTimeOff"
  | "instructorBusy"
  | "travelTooLong"
  | "studentBusy"
  | "studentUnavailable"
  | "outsideStudentAvailability"
  | "notEnoughHours"
  | "noVehicle"
  | "dayLimit";

export type Conflict = { key: ConflictKey; params?: Record<string, string | number> };

export type SlotResult = {
  ok: boolean;
  conflicts: Conflict[];
  /** conflicts that an admin override waved through (flagged, not blocking) */
  overridden: Conflict[];
  vehicleId: string | null;
};

const OVERRIDABLE = {
  studentUnavailable: "availability",
  outsideStudentAvailability: "availability",
  notEnoughHours: "hours",
} as const;

export function checkSlot(ctx: SlotContext, input: SlotInput): SlotResult {
  const tz = ctx.tz ?? SCHOOL_TZ;
  const { instructor, student } = ctx;
  const { startsAt, endsAt } = input;
  const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const raw: Conflict[] = [];
  const skip = (b: { id: string }) => b.id !== input.excludeLessonId;

  // 1. Instructor working hours and time off
  const weekday = isoWeekday(startsAt, tz);
  const s = localParts(startsAt, tz).minutes;
  const e = s + durationMin;
  const sameLocalDay = localDateKey(startsAt, tz) === localDateKey(new Date(endsAt.getTime() - 1), tz);
  const inHours =
    sameLocalDay && instructor.workingHours.some((w) => w.weekday === weekday && s >= w.startMin && e <= w.endMin);
  if (!inHours) raw.push({ key: "outsideWorkingHours" });
  if (hitsUnavailability(instructor.timeOff, startsAt, endsAt)) raw.push({ key: "instructorTimeOff" });

  // 2. Instructor overlaps (lessons, theory groups, exams) incl. travel buffer
  const busy = instructor.busy.filter(skip).sort((a, b) => +a.startsAt - +b.startsAt);
  const travelNeeded = (b: Busy) =>
    input.pickup && b.lat != null && b.lng != null
      ? travelMinutes(input.pickup, { lat: b.lat, lng: b.lng }, ctx.settings.urbanFactor, ctx.settings.speedKmh)
      : ctx.settings.travelBufferMin;
  let overlapReported = false;
  for (const b of busy) {
    if (overlaps(startsAt, endsAt, b.startsAt, b.endsAt)) {
      if (!overlapReported) raw.push({ key: "instructorBusy", params: { with: b.label } });
      overlapReported = true;
    }
  }
  if (!overlapReported) {
    const prev = [...busy].reverse().find((b) => b.endsAt <= startsAt);
    const next = busy.find((b) => b.startsAt >= endsAt);
    for (const [other, gapMs] of [
      [prev, prev ? startsAt.getTime() - prev.endsAt.getTime() : 0],
      [next, next ? next.startsAt.getTime() - endsAt.getTime() : 0],
    ] as const) {
      if (!other) continue;
      const needed = travelNeeded(other);
      const gap = Math.round(gapMs / 60_000);
      // only same-day neighbours matter
      if (gap < needed && gap < 12 * 60) raw.push({ key: "travelTooLong", params: { with: other.label, gap, needed } });
    }
  }

  // 3. Student availability / unavailability (practical lessons)
  if (student) {
    if (hitsUnavailability(student.unavailability, startsAt, endsAt)) raw.push({ key: "studentUnavailable" });
    if (input.type === "PRACTICAL" && !fitsAvailability(student.availability, startsAt, endsAt, tz)) {
      raw.push({ key: "outsideStudentAvailability" });
    }
    // 4. Student overlap
    const clash = student.busy.filter(skip).find((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt));
    if (clash) raw.push({ key: "studentBusy" });
    // 5. Hours
    if (input.type === "PRACTICAL" && student.minutesAvailable < durationMin) {
      raw.push({ key: "notEnoughHours", params: { available: student.minutesAvailable, needed: durationMin } });
    }
  }

  // 6. Vehicle (practical + exam lessons)
  let vehicleId: string | null = null;
  if (input.type !== "THEORY") {
    const gearbox = input.gearbox ?? null;
    const matches = ctx.vehicles
      .filter((v) => (gearbox ? v.gearbox === gearbox : true))
      .filter((v) => v.status === "ACTIVE")
      .filter((v) => !v.apkDueDate || v.apkDueDate >= startOfLocalDay(startsAt, tz))
      .filter((v) => !hitsUnavailability(v.unavailability, startsAt, endsAt))
      .filter((v) => !v.busy.filter(skip).some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt)));
    const pick =
      matches.find((v) => v.id === input.preferredVehicleId) ??
      matches.find((v) => v.id === instructor.defaultVehicleId) ??
      matches[0];
    if (pick) vehicleId = pick.id;
    else raw.push({ key: "noVehicle", params: { gearbox: gearbox ?? "MANUAL" } });
  }

  // 7. Instructor day total
  const dayKey = localDateKey(startsAt, tz);
  const dayMinutes = busy
    .filter((b) => localDateKey(b.startsAt, tz) === dayKey)
    .reduce((sum, b) => sum + Math.round((+b.endsAt - +b.startsAt) / 60_000), 0);
  if (dayMinutes + durationMin > instructor.maxMinutesPerDay) {
    raw.push({ key: "dayLimit", params: { max: instructor.maxMinutesPerDay } });
  }

  // split admin-overridable conflicts
  const conflicts: Conflict[] = [];
  const overridden: Conflict[] = [];
  for (const c of raw) {
    const kind = OVERRIDABLE[c.key as keyof typeof OVERRIDABLE];
    if (kind && input.overrides?.[kind]) overridden.push(c);
    else conflicts.push(c);
  }
  return { ok: conflicts.length === 0, conflicts, overridden, vehicleId };
}

function startOfLocalDay(d: Date, tz: string): Date {
  const p = localParts(d, tz);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0)); // compared to a date-only (UTC midnight) APK date
}
