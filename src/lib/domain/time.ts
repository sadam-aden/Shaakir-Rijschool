/**
 * Time helpers. All instants are UTC `Date`s; wall-clock logic happens in the school's
 * timezone (Europe/Amsterdam) via Intl, so DST is handled by the platform.
 */
export const SCHOOL_TZ = "Europe/Amsterdam";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o as unknown as Parts;
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function zoneOffsetMs(date: Date, tz: string): number {
  const p = partsInZone(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a local wall-clock time in `tz` to the UTC instant. */
export function zonedToUtc(y: number, m: number, d: number, hour = 0, minute = 0, tz = SCHOOL_TZ): Date {
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const off1 = zoneOffsetMs(new Date(guess), tz);
  let t = guess - off1;
  const off2 = zoneOffsetMs(new Date(t), tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

/** Local calendar date and minutes since local midnight for an instant. */
export function localParts(date: Date, tz = SCHOOL_TZ) {
  const p = partsInZone(date, tz);
  return { year: p.year, month: p.month, day: p.day, minutes: p.hour * 60 + p.minute };
}

/** 'YYYY-MM-DD' of the instant in the school timezone. */
export function localDateKey(date: Date, tz = SCHOOL_TZ): string {
  const p = partsInZone(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** ISO weekday in the school timezone: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: Date, tz = SCHOOL_TZ): number {
  const p = partsInZone(date, tz);
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** ISO 8601 week number (and ISO year) of the local date. */
export function isoWeek(date: Date, tz = SCHOOL_TZ): { week: number; year: number } {
  const p = partsInZone(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** UTC instant of local midnight at the start of the Monday of the given date's week. */
export function startOfIsoWeek(date: Date, tz = SCHOOL_TZ): Date {
  const p = partsInZone(date, tz);
  const wd = isoWeekday(date, tz);
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day - (wd - 1)));
  return zonedToUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 0, 0, tz);
}

/** Time-of-day bucket used for the dashboard greeting. */
export function greetingKey(date: Date, tz = SCHOOL_TZ): "morning" | "afternoon" | "evening" {
  const h = Math.floor(localParts(date, tz).minutes / 60);
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
