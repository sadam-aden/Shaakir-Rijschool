// Dev tool: drags the first "to schedule" card onto Tuesday 14:30 and reports what happened.
import { chromium } from "@playwright/test";
const base = process.env.BASE ?? "http://localhost:3000";
const out = process.env.OUT ?? "";
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/login`);
await page.fill("input[name=email]", "shaakir@example.com");
await page.fill("input[name=password]", "RijSchool2026!");
await page.click("form:has(input[name=password]) button");
await page.waitForURL(`${base}/`);
await page.goto(`${base}/agenda?date=${process.env.DATE ?? ""}`, { waitUntil: "networkidle" });
const card = page.locator("aside [class*='cursor-grab']").first();
const name = (await card.locator("span.truncate").first().textContent())?.trim();
const box = await card.boundingBox();
const cols = await page.locator("div.relative.border-l").all();
const col = await cols[1].boundingBox(); // Tuesday
const targetY = col.y + (14.5 * 60 - 8 * 60) * (52 / 60);
await page.mouse.move(box.x + 40, box.y + 20);
await page.mouse.down();
await page.mouse.move(box.x + 120, box.y + 60, { steps: 5 });
await page.mouse.move(col.x + col.width / 2, targetY, { steps: 12 });
await page.waitForTimeout(300);
if (out) await page.screenshot({ path: `${out}/drag-mid.png` });
await page.mouse.up();
await page.waitForTimeout(2500);
if (out) await page.screenshot({ path: `${out}/drag-after.png` });
console.log("dragged:", name);
await browser.close();
