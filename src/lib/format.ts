import { intlTag, type AppLocale } from "@/i18n/config";
import { SCHOOL_TZ } from "@/lib/domain/time";

export function formatDateLong(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(intlTag[locale], {
    timeZone: SCHOOL_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(date);
}

export function formatDateShort(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(intlTag[locale], {
    timeZone: SCHOOL_TZ, day: "numeric", month: "short",
  }).format(date);
}

/** 24-hour clock in both languages. */
export function formatTime(date: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(intlTag[locale], {
    timeZone: SCHOOL_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

/** Money is stored as integer cents. nl: "€ 1.240,00". */
export function formatMoney(cents: number, locale: AppLocale) {
  return new Intl.NumberFormat(intlTag[locale], { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatNumber(n: number, locale: AppLocale, maxFraction = 2) {
  return new Intl.NumberFormat(intlTag[locale], { maximumFractionDigits: maxFraction }).format(n);
}

/** Minutes → "7,5 u" / "7.5 h". */
export function formatHours(minutes: number, locale: AppLocale) {
  const unit = locale === "nl" ? "u" : "h";
  return `${formatNumber(minutes / 60, locale)} ${unit}`;
}
