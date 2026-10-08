export const themes = ["light", "dark", "system"] as const;
export type Theme = (typeof themes)[number];
export const THEME_COOKIE = "theme";
export const defaultTheme: Theme = "system";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark" || v === "system";
}

