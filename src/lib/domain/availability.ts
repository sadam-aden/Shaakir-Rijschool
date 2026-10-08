import { isoWeekday, localParts, SCHOOL_TZ } from "./time";

export type DayPart = "MORNING" | "AFTERNOON" | "EVENING";
export type Avail = { weekday: number; part: DayPart; startMin?: number | null; endMin?: number | null };
export type Interval = { startsAt: Date; endsAt: Date };

/** Minutes since local midnight: morning 08–12, afternoon 12–17, evening 17–20. */
export const DAY_PART_RANGE: Record<DayPart, [number, number]> = {
  MORNING: [8 * 60, 12 * 60],
  AFTERNOON: [12 * 60, 17 * 60],
  EVENING: [17 * 60, 20 * 60],
};
export const DAY_PARTS: DayPart[] = ["MORNING", "AFTERNOON", "EVENING"];

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

/** Merged availability windows (minutes since midnight) for one ISO weekday. */
export function windowsFor(avail: Avail[], weekday: number): [number, number][] {
  const raw = avail
    .filter((a) => a.weekday === weekday)
    .map((a): [number, number] => [a.startMin ?? DAY_PART_RANGE[a.part][0], a.endMin ?? DAY_PART_RANGE[a.part][1]])
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const w of raw) {
    const last = out[out.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else out.push([w[0], w[1]]);
  }
  return out;
}

/**
 * Does the lesson lie fully inside the student's availability?
 * A student without any availability entered is treated as always available.
 */
export function fitsAvailability(avail: Avail[], startsAt: Date, endsAt: Date, tz = SCHOOL_TZ): boolean {
  if (avail.length === 0) return true;
  const weekday = isoWeekday(startsAt, tz);
  const s = localParts(startsAt, tz).minutes;
  const e = s + Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  return windowsFor(avail, weekday).some(([a, b]) => s >= a && e <= b);
}

export function hitsUnavailability(blocks: Interval[], startsAt: Date, endsAt: Date) {
  return blocks.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt));
}

/** Groups weekdays by day part for compact text, e.g. [{part:'MORNING', days:[3,6]}]. */
export function groupByPart(avail: Avail[]): { part: DayPart; days: number[] }[] {
  return DAY_PARTS.map((part) => ({
    part,
    days: [...new Set(avail.filter((a) => a.part === part).map((a) => a.weekday))].sort((x, y) => x - y),
  })).filter((g) => g.days.length > 0);
}
