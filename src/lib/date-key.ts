/** Calendar-date helpers on 'YYYY-MM-DD' keys (school-local dates). Pure string/UTC math, no timezone surprises. */
export type DateKey = string;

const parse = (k: DateKey) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (k: DateKey, n: number): DateKey => fmt(new Date(parse(k).getTime() + n * 86_400_000));
export const isoWeekdayOfKey = (k: DateKey) => parse(k).getUTCDay() || 7;
export const mondayOfKey = (k: DateKey): DateKey => addDays(k, -(isoWeekdayOfKey(k) - 1));
export const dayNumber = (k: DateKey) => parse(k).getUTCDate();
export const keyParts = (k: DateKey) => {
  const d = parse(k);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

export function formatKey(k: DateKey, locale: "nl" | "en", opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { ...opts, timeZone: "UTC" }).format(parse(k));
}
