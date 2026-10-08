export const locales = ["nl", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "nl";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Intl locale tags used for formatting. */
export const intlTag: Record<AppLocale, string> = { nl: "nl-NL", en: "en-GB" };

export function isLocale(v: unknown): v is AppLocale {
  return v === "nl" || v === "en";
}
