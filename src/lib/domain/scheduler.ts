/**
 * The AI planner for one instructor and one day (pure, deterministic, unit tested).
 *
 *   1. demand list  – students who still have hours, no lesson that day, and are available on that weekday
 *   2. priority     – exam soon > hours left vs time to exam > days since last lesson > waiting time
 *   3. greedy       – best-fit slot per student, best candidates first (fixed blocks are already in the context)
 *   4. improvement  – local search: shift lessons / swap equal-length lessons when that cuts driving and gaps
 *
 * Every placement goes through the same `checkSlot` as manual booking, so the hard rules (student availability,
 * hours, gearbox, 8 h/day, working hours, car, no clashes) can never be broken. The scheduler only *decides among
 * valid slots*; an LLM is never involved in the decision.
 */
import { windowsFor, type Avail, type Interval } from "./availability";
import { rankSlots, type DayRef } from "./best-fit";
import { checkSlot, type Busy, type Conflict, type Gearbox, type SlotContext, type VehicleCtx } from "./check-slot";
import { travelMinutes, type LatLng } from "./geo";
import { isoWeekday, zonedToUtc } from "./time";

export type SchedulerSettings = {
  examFirst: boolean;
  defaultDurationMin: number;
  examDurationMin: number;
  maxTravelMinutes: number;
};

export type Candidate = {
  studentId: string;
  name: string;
  gearbox: Gearbox;
  availability: Avail[];
  unavailability: Interval[];
  minutesAvailable: number;
  hasOverdueInvoice: boolean;
  pickup: LatLng | null;
  lastLessonAt: Date | null;
  /** student since (used for waiting time when there was never a lesson) */
  since: Date;
  exam: { at: Date; readiness: "READY" | "NEEDS_LESSONS"; lessonsLeft: number | null } | null;
  examRequested: boolean;
};

export type Placement = {
  studentId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  vehicleId: string | null;
  pickup: LatLng | null;
  gearbox: Gearbox;
  examCandidate: boolean;
};

export type SkipReason =
  | "noHours" | "unpaidOverdue" | "notAvailableThatDay" | "outsideAvailability" | "studentUnavailable"
  | "noCar" | "dayFull" | "noSlot" | "tooFarAway";

export type SchedulerResult = {
  placements: Placement[];
  skipped: { studentId: string; name: string; reason: SkipReason }[];
  stats: { candidates: number; lessons: number; minutes: number; travelMinutes: number; idleMinutes: number; costBefore: number; costAfter: number };
};

const DAY_MS = 86_400_000;
const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY_MS;
const MIN_LESSON = 30;

// ───────────── priority ─────────────

/** Higher = planned earlier. Exam candidates first (when enabled), then how long the student has been waiting. */
export function priorityOf(c: Candidate, now: Date, examFirst = true): number {
  let p = 0;
  if (examFirst) {
    if (c.examRequested) p += 800;
    if (c.exam) {
      const days = Math.max(daysBetween(now, c.exam.at), 0);
      p += days <= 3 ? 1000 : days <= 7 ? 800 : days <= 14 ? 500 : 0;
      if (c.exam.readiness === "NEEDS_LESSONS") {
        p += 100;
        // many lessons still needed in little time → more urgent
        const ratio = (c.exam.lessonsLeft ?? 2) / Math.max(days, 1);
        p += Math.min(ratio * 200, 300);
      }
    }
  }
  const sinceLast = c.lastLessonAt ? daysBetween(c.lastLessonAt, now) : 30;
  p += Math.min(Math.max(sinceLast, 0), 30) * 10; // days since last lesson (max 300)
  p += Math.min(Math.max(daysBetween(c.since, now), 0), 60); // waiting time (max 60)
  return p;
}

export const isExamCandidate = (c: Candidate, now: Date) =>
  c.examRequested || (!!c.exam && daysBetween(now, c.exam.at) <= 14);

// ───────────── helpers ─────────────

type Ctx = SlotContext;

function studentCtx(c: Candidate): NonNullable<Ctx["student"]> {
  return { id: c.studentId, availability: c.availability, unavailability: c.unavailability, minutesAvailable: c.minutesAvailable, hasOverdueInvoice: c.hasOverdueInvoice, busy: [] };
}

/** Context with the fixed blocks plus all placements except the excluded students (for re-validation while improving). */
function buildCtx(base: Ctx, placements: Placement[], excluded: Set<string> = new Set()): Ctx {
  const mine = placements.filter((p) => !excluded.has(p.studentId));
  const busy: Busy[] = [
    ...base.instructor.busy,
    ...mine.map((p): Busy => ({
      id: `draft-${p.studentId}`, kind: "LESSON", label: p.name, startsAt: p.startsAt, endsAt: p.endsAt, lat: p.pickup?.lat ?? null, lng: p.pickup?.lng ?? null,
    })),
  ];
  const vehicles: VehicleCtx[] = base.vehicles.map((v) => ({
    ...v,
    busy: [...v.busy, ...mine.filter((p) => p.vehicleId === v.id).map((p) => ({ id: `draft-${p.studentId}`, startsAt: p.startsAt, endsAt: p.endsAt }))],
  }));
  return { ...base, instructor: { ...base.instructor, busy }, vehicles };
}

/** Driving time from the neighbours of a slot: undefined coordinates never count against a slot. */
function neighbourTravel(ctx: Ctx, pickup: LatLng | null, startsAt: Date, endsAt: Date) {
  if (!pickup) return 0;
  const busy = ctx.instructor.busy.filter((b) => b.lat != null && b.lng != null);
  const prev = [...busy].filter((b) => b.endsAt <= startsAt).sort((a, b) => +b.endsAt - +a.endsAt)[0];
  const next = busy.filter((b) => b.startsAt >= endsAt).sort((a, b) => +a.startsAt - +b.startsAt)[0];
  const t = (b?: Busy) => (b ? travelMinutes(pickup, { lat: b.lat!, lng: b.lng! }, ctx.settings.urbanFactor, ctx.settings.speedKmh) : 0);
  return Math.max(t(prev), t(next));
}

/**
 * Cost of a day: driving between consecutive pick-ups plus idle time; small unusable gaps (20–60 min) are extra bad.
 * Lower is better. Fixed blocks (theory, exams, other lessons) take part so the plan fits around them.
 */
export function dayCost(ctx: Ctx, placements: Placement[]) {
  const all = [
    ...ctx.instructor.busy.map((b) => ({ s: b.startsAt, e: b.endsAt, p: b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : null })),
    ...placements.map((p) => ({ s: p.startsAt, e: p.endsAt, p: p.pickup })),
  ].sort((a, b) => +a.s - +b.s);
  let travel = 0;
  let idle = 0;
  let cost = 0;
  for (let i = 1; i < all.length; i++) {
    const gap = Math.round((+all[i].s - +all[i - 1].e) / 60_000);
    if (gap < 0) continue;
    const drive = all[i - 1].p && all[i].p ? travelMinutes(all[i - 1].p!, all[i].p!, ctx.settings.urbanFactor, ctx.settings.speedKmh) : ctx.settings.travelBufferMin;
    travel += drive;
    const spare = Math.max(gap - drive, 0);
    idle += spare;
    cost += drive + (spare > 20 ? spare * 0.3 : 0) + (gap > 20 && gap < 60 ? 15 : 0);
  }
  return { cost, travel, idle };
}

const durationsFor = (c: Candidate, now: Date, s: SchedulerSettings) => {
  const want = isExamCandidate(c, now) ? s.examDurationMin : s.defaultDurationMin;
  const list = [want, s.defaultDurationMin, 60, 45, MIN_LESSON].filter((d, i, a) => a.indexOf(d) === i && d >= MIN_LESSON && d % 15 === 0);
  return list.filter((d) => d <= c.minutesAvailable);
};

function skipReason(counts: Map<string, number>): SkipReason {
  const map: Record<string, SkipReason> = {
    outsideStudentAvailability: "outsideAvailability", studentUnavailable: "studentUnavailable", noVehicle: "noCar", noVehicleRegistered: "noCar",
    dayLimit: "dayFull", unpaidOverdue: "unpaidOverdue", notEnoughHours: "noHours",
  };
  let best: [string, number] | null = null;
  for (const [k, n] of counts) if (!best || n > best[1]) best = [k, n];
  return (best && map[best[0]]) || "noSlot";
}

// ───────────── the scheduler ─────────────

export function generateDay(base: Ctx, candidates: Candidate[], day: DayRef, now: Date, settings: SchedulerSettings): SchedulerResult {
  const tz = base.tz;
  const dayStart = zonedToUtc(day.year, day.month, day.day, 0, 0, tz);
  const weekday = isoWeekday(new Date(dayStart.getTime() + 12 * 3_600_000), tz);
  const skipped: SchedulerResult["skipped"] = [];

  // 1 + 2: demand list in priority order (ties: earlier student id keeps the result deterministic)
  const demand: Candidate[] = [];
  for (const c of candidates) {
    if (c.minutesAvailable < MIN_LESSON) skipped.push({ studentId: c.studentId, name: c.name, reason: "noHours" });
    else if (c.hasOverdueInvoice) skipped.push({ studentId: c.studentId, name: c.name, reason: "unpaidOverdue" });
    else if (c.availability.length > 0 && windowsFor(c.availability, weekday).length === 0) skipped.push({ studentId: c.studentId, name: c.name, reason: "notAvailableThatDay" });
    else demand.push(c);
  }
  demand.sort((a, b) => priorityOf(b, now, settings.examFirst) - priorityOf(a, now, settings.examFirst) || a.studentId.localeCompare(b.studentId));

  // 3: greedy best fit
  const placements: Placement[] = [];
  for (const c of demand) {
    const ctx = { ...buildCtx(base, placements), student: studentCtx(c) };
    // the instructor's day is full: say so instead of reporting a vague "no slot"
    const dayMinutes = ctx.instructor.busy.reduce((a, b) => a + Math.round((+b.endsAt - +b.startsAt) / 60_000), 0);
    if (dayMinutes + MIN_LESSON > ctx.instructor.maxMinutesPerDay) {
      skipped.push({ studentId: c.studentId, name: c.name, reason: "dayFull" });
      continue;
    }
    let placed: Placement | null = null;
    const counts = new Map<string, number>();
    let travelRejected = false;

    for (const d of durationsFor(c, now, settings)) {
      const ranked = rankSlots(ctx, { type: "PRACTICAL", gearbox: c.gearbox, pickup: c.pickup }, day, d);
      for (const r of ranked) {
        if (!r.ok) {
          const k = r.conflicts[0]?.key;
          if (k && k !== "outsideWorkingHours") counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
      const valid = ranked.filter((r) => r.ok && neighbourTravel(ctx, c.pickup, r.startsAt, r.endsAt) <= settings.maxTravelMinutes);
      if (ranked.some((r) => r.ok) && valid.length === 0) travelRejected = true;
      if (valid.length) {
        const best = valid.reduce((a, b) => (b.score > a.score ? b : a));
        placed = { studentId: c.studentId, name: c.name, startsAt: best.startsAt, endsAt: best.endsAt, durationMin: d, vehicleId: best.vehicleId, pickup: c.pickup, gearbox: c.gearbox, examCandidate: isExamCandidate(c, now) };
        break;
      }
    }
    if (placed) placements.push(placed);
    else skipped.push({ studentId: c.studentId, name: c.name, reason: travelRejected ? "tooFarAway" : skipReason(counts) });
  }

  // 4: local search — shifts and swaps that lower the cost of the day
  const byId = new Map(candidates.map((c) => [c.studentId, c]));
  const before = dayCost(buildCtx(base, []), placements);
  let current = before.cost;

  const tryReplace = (next: Placement[]) => {
    const cost = dayCost(buildCtx(base, []), next).cost;
    if (cost < current - 1) {
      current = cost;
      return true;
    }
    return false;
  };
  const validPlacement = (p: Placement, others: Placement[]) => {
    const c = byId.get(p.studentId)!;
    const ctx = { ...buildCtx(base, others), student: studentCtx(c) };
    const r = checkSlot(ctx, { startsAt: p.startsAt, endsAt: p.endsAt, type: "PRACTICAL", gearbox: p.gearbox, pickup: p.pickup, preferredVehicleId: p.vehicleId });
    return r.ok && neighbourTravel(ctx, p.pickup, p.startsAt, p.endsAt) <= settings.maxTravelMinutes ? r.vehicleId : undefined;
  };

  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    // shifts
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      const others = placements.filter((_, j) => j !== i);
      let best: { placement: Placement; cost: number } | null = null;
      for (let m = 8 * 60; m + p.durationMin <= 20 * 60; m += 15) {
        const startsAt = zonedToUtc(day.year, day.month, day.day, Math.floor(m / 60), m % 60, tz);
        if (+startsAt === +p.startsAt) continue;
        const cand: Placement = { ...p, startsAt, endsAt: new Date(+startsAt + p.durationMin * 60_000) };
        const vehicleId = validPlacement(cand, others);
        if (vehicleId === undefined) continue;
        const next = [...others.slice(0, i), { ...cand, vehicleId }, ...others.slice(i)];
        const cost = dayCost(buildCtx(base, []), next).cost;
        if (cost < current - 1 && (!best || cost < best.cost)) best = { placement: { ...cand, vehicleId }, cost };
      }
      if (best) {
        placements[i] = best.placement;
        current = best.cost;
        improved = true;
      }
    }
    // swaps of equal-length lessons
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        if (a.durationMin !== b.durationMin || +a.startsAt === +b.startsAt) continue;
        const na: Placement = { ...a, startsAt: b.startsAt, endsAt: b.endsAt };
        const nb: Placement = { ...b, startsAt: a.startsAt, endsAt: a.endsAt };
        const rest = placements.filter((_, k) => k !== i && k !== j);
        const va = validPlacement(na, [...rest, nb]);
        const vb = validPlacement(nb, [...rest, na]);
        if (va === undefined || vb === undefined) continue;
        const next = placements.map((p, k) => (k === i ? { ...na, vehicleId: va } : k === j ? { ...nb, vehicleId: vb } : p));
        if (tryReplace(next)) {
          placements[i] = next[i];
          placements[j] = next[j];
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  placements.sort((a, b) => +a.startsAt - +b.startsAt);
  const after = dayCost(buildCtx(base, []), placements);
  return {
    placements,
    skipped,
    stats: {
      candidates: candidates.length, lessons: placements.length, minutes: placements.reduce((a, p) => a + p.durationMin, 0),
      travelMinutes: after.travel, idleMinutes: after.idle, costBefore: Math.round(before.cost), costAfter: Math.round(after.cost),
    },
  };
}

export type { Conflict };
