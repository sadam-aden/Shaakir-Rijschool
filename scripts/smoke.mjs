// Dev tool: logs in with Edge, visits pages, reports HTTP errors / console errors and saves screenshots.
// Usage: node scripts/smoke.mjs [--user=anouk@example.com] [--out=dir] [--base=http://localhost:3000] /path1 /path2 ...
import { chromium } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const base = opt("base", "http://localhost:3000");
const user = opt("user", "shaakir@example.com");
const out = opt("out", "");
const paths = args.filter((a) => a.startsWith("/"));

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().slice(0, 200)}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));

await page.goto(`${base}/login`);
await page.fill("input[name=email]", user);
await page.fill("input[name=password]", process.env.SEED_PASSWORD ?? "RijSchool2026!");
await page.click('form:has(input[name=password]) button');
await page.waitForURL(`${base}/`, { timeout: 30000 });

for (const p of paths) {
  problems.length = 0;
  const res = await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 60000 });
  const status = res?.status();
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/${p.replace(/[^a-z0-9]+/gi, "_") || "home"}.png`, fullPage: false });
  }
  console.log(`${status} ${p}${problems.length ? "\n   " + problems.join("\n   ") : ""}`);
}
await browser.close();
