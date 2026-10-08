import { expect, type Page } from "@playwright/test";

export const PASSWORD = "RijSchool2026!";

export async function login(page: Page, email = "shaakir@example.com") {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("form:has(input[name=password]) button");
  await page.waitForURL("/");
}

/** 'YYYY-MM-DD' of the next given ISO weekday (1 = Monday) that is at least 7 days away, so tests never depend on the time of day. */
export function nextWeekday(isoWeekday: number) {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  while (((d.getDay() + 6) % 7) + 1 !== isoWeekday) d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function expectToast(page: Page, text: RegExp | string) {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}
