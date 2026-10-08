import { intlTag, type AppLocale } from "@/i18n/config";
import { SCHOOL_TZ } from "@/lib/domain/time";

/** Narrow weekday letter for an ISO weekday (1 = Monday). nl: M D W D V Z; en: M T W T F S. */
export function weekdayNarrow(weekday: number, locale: AppLocale) {
  return new Intl.DateTimeFormat(intlTag[locale], { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 27 + weekday)));
}

export function weekdayShort(weekday: number, locale: AppLocale) {
  return new Intl.DateTimeFormat(intlTag[locale], { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 27 + weekday)));
}

/** "di 29 sep" / "Tue 29 Sep" in the school timezone. */
export function formatDayLabel(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(intlTag[locale], { weekday: "short", day: "numeric", month: "short", timeZone: SCHOOL_TZ }).format(date);
}

export function formatWeekdayShort(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(intlTag[locale], { weekday: "short", timeZone: SCHOOL_TZ }).format(date);
}

export function sameLocalDay(a: Date, b: Date) {
  const f = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ }).format(d);
  return f(a) === f(b);
}

/** Minutes → "7,5" (no unit), for compact "7,5 van 30" displays. */
export function hoursNumber(minutes: number, locale: AppLocale) {
  return new Intl.NumberFormat(intlTag[locale], { maximumFractionDigits: 2 }).format(minutes / 60);
}
