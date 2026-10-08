import "server-only";
import { cookies } from "next/headers";
import { defaultTheme, isTheme, THEME_COOKIE, type Theme } from "./theme";

export async function getTheme(): Promise<Theme> {
  const c = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(c) ? c : defaultTheme;
}
