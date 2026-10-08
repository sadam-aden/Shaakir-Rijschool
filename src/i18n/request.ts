import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, intlTag } from "./config";

export default getRequestConfig(async () => {
  const store = await cookies();
  const c = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(c) ? c : defaultLocale;
  return {
    locale,
    timeZone: "Europe/Amsterdam",
    messages: (await import(`../../messages/${locale}.json`)).default,
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short" },
        long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
        time: { hour: "2-digit", minute: "2-digit", hour12: false },
      },
    },
    // keep tag available for number/date formatting helpers
    now: undefined,
    ...(intlTag[locale] ? {} : {}),
  };
});
