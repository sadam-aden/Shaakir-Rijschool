/**
 * Best-fit slot ranking: candidates every 15 minutes, filtered by checkSlot and scored on
 * adjacency, travel, unusable gaps, availability centre, car continuity and day balance.
 * The explanation is returned as translatable factors (messages: bestFit.*), never as prose.
 */
import { windowsFor } from "./availability";
import { checkSlot, type Busy, type Conflict, type SlotContext, type SlotInput } from "./check-slot";
import { travelMinutes } from "./geo";
import { isoWeekday, localDateKey, zonedToUtc, SCHOOL_TZ } from "./time";

export type Factor = {
  key: "onlyInPart" | "adjacentBefore" | "adjacentAfter" | "shortTravel" | "smallGap" | "availabilityCenter" | "sameCar" | "lightDay" | "longDay";
  points: number;
  params?: Record<string, string | number>;
};

export type RankedSlot = {
  startsAt: Date;
  endsAt: Date;
  ok: boolean;
  conflicts: Conflict[];
  vehicleId: string | null;
  score: number;
  factors: Factor[];
  best: boolean;
};

export type DayRef = { year: number; month: number; day: number };
export type RankOptions = { fromMin?: number; toMin?: number; stepMin?: number };

const ADJACENT_MAX_GAP = 30;
const USABLE_GAP = 60;

export function rankSlots(
  ctx: SlotContext,
  base: Omit<SlotInput, "startsAt" | "endsAt">,
  day: DayRef,
  durationMin: number,
  opts: RankOptions = {},
): RankedSlot[] {
  const tz = ctx.tz ?? SCHOOL_TZ;
  const { fromMin = 8 * 60, toMin = 20 * 60, stepMin = 15 } = opts;
  const out: RankedSlot[] = [];
  for (let m = fromMin; m + durationMin <= toMin; m += stepMin) {
    const startsAt = zonedToUtc(day.year, day.month, day.day, Math.floor(m / 60), m % 60, tz);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    const r = checkSlot(ctx, { ...base, startsAt, endsAt });
    const { score, factors } = r.ok
      ? scoreSlot(ctx, base, startsAt, endsAt, durationMin, r.vehicleId)
      : { score: -Infinity, factors: [] as Factor[] };
    out.push({ startsAt, endsAt, ok: r.ok, conflicts: r.conflicts, vehicleId: r.vehicleId, score, factors, best: false });
  }

  const okSlots = out.filter((s) => s.ok);
  if (okSlots.length) {
    const best = okSlots.reduce((a, b) => (b.score > a.score ? b : a)); // earliest wins ties
    best.best = true;
    // "only slot of this size in this part of the day"
    const part = dayPartOf(best.startsAt, tz);
    if (okSlots.filter((s) => dayPartOf(s.startsAt, tz) === part).length === 1) {
      best.factors.unshift({ key: "onlyInPart", points: 99, params: { part, duration: durationMin } });
    }
  }
  return out;
}

function dayPartOf(d: Date, tz: string): "MORNING" | "AFTERNOON" | "EVENING" {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(d));
  return h < 12 ? "MORNING" : h < 17 ? "AFTERNOON" : "EVENING";
}

function scoreSlot(
  ctx: SlotContext,
  base: Omit<SlotInput, "startsAt" | "endsAt">,
  startsAt: Date,
  endsAt: Date,
  durationMin: number,
  vehicleId: string | null,
): { score: number; factors: Factor[] } {
  const tz = ctx.tz ?? SCHOOL_TZ;
  const factors: Factor[] = [];
  const dayKey = localDateKey(startsAt, tz);
  const dayBusy = ctx.instructor.busy
    .filter((b) => b.id !== base.excludeLessonId && localDateKey(b.startsAt, tz) === dayKey)
    .sort((a, b) => +a.startsAt - +b.startsAt);
  const prev: Busy | undefined = [...dayBusy].reverse().find((b) => b.endsAt <= startsAt);
  const next: Busy | undefined = dayBusy.find((b) => b.startsAt >= endsAt);

  for (const [other, gapMs, side] of [
    [prev, prev ? +startsAt - +prev.endsAt : 0, "Before"],
    [next, next ? +next.startsAt - +endsAt : 0, "After"],
  ] as const) {
    if (!other) continue;
    const gap = Math.round(gapMs / 60_000);
    if (gap <= ADJACENT_MAX_GAP) {
      factors.push({ key: `adjacent${side}` as "adjacentBefore" | "adjacentAfter", points: 20, params: { name: other.label, gap } });
    } else if (gap < USABLE_GAP) {
      factors.push({ key: "smallGap", points: -15, params: { gap } });
    }
    if (base.pickup && other.lat != null && other.lng != null) {
      const minutes = travelMinutes(base.pickup, { lat: other.lat, lng: other.lng }, ctx.settings.urbanFactor, ctx.settings.speedKmh);
      const pts = Math.max(0, 12 - minutes);
      if (pts > 0) factors.push({ key: "shortTravel", points: pts, params: { minutes, name: other.label } });
    }
  }

  // closeness to the centre of the student's availability window
  if (ctx.student?.availability.length) {
    const wd = isoWeekday(startsAt, tz);
    const startM = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(startsAt)) * 60 +
      Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, minute: "2-digit" }).format(startsAt));
    const mid = startM + durationMin / 2;
    const win = windowsFor(ctx.student.availability, wd).find(([a, b]) => startM >= a && startM + durationMin <= b);
    if (win) {
      const half = (win[1] - win[0]) / 2;
      const pts = Math.round(15 * Math.max(0, 1 - Math.abs(mid - (win[0] + half)) / half));
      if (pts > 0) factors.push({ key: "availabilityCenter", points: pts });
    }
  }

  if (vehicleId && vehicleId === ctx.instructor.defaultVehicleId) factors.push({ key: "sameCar", points: 5 });

  const load = dayBusy.reduce((s, b) => s + Math.round((+b.endsAt - +b.startsAt) / 60_000), 0);
  if (load + durationMin > 360) factors.push({ key: "longDay", points: -10 });
  else if (load < 240) factors.push({ key: "lightDay", points: 5 });

  const score = factors.reduce((s, f) => s + f.points, 0);
  factors.sort((a, b) => b.points - a.points);
  return { score, factors };
}

/** Top positive factors, used to build the one-line explanation. */
export function explanationFactors(slot: RankedSlot, max = 3): Factor[] {
  return slot.factors.filter((f) => f.points > 0).slice(0, max);
}
