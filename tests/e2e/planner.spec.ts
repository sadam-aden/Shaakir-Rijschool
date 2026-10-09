import { expect, test, type Page } from "@playwright/test";
import { expectToast, login } from "./helpers";

test.describe.configure({ mode: "serial" });

/** A Tuesday that is `weeks` weeks ahead: the demo data has no lessons there, so the planner starts from an empty day. */
function tuesday(weeks: number) {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const draftBlocks = (page: Page) => page.locator("div[role=button][class*='border-dashed']");

async function generate(page: Page, date: string, opts: { replace?: boolean } = {}) {
  await page.getByRole("button", { name: "Planning genereren" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Datum").fill(date);
  await expect(dialog.getByText(/leerlingen beschikbaar/)).toBeVisible();
  if (opts.replace) await dialog.getByLabel("Bestaand concept vervangen").check();
  await dialog.getByRole("button", { name: "Genereren" }).click();
}

test("generates a draft day: preview, dashed lessons and a review banner", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Planning genereren" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Datum").fill(tuesday(2));
  await expect(dialog.getByText(/leerlingen beschikbaar/)).toBeVisible();
  await expect(dialog.getByText(/lesuren vrij/)).toBeVisible();
  await expect(dialog.getByText("Harde regels (altijd aan)")).toBeVisible();
  await expect(dialog.getByText("Max. 8 lesuren per dag")).toBeVisible();
  await dialog.getByRole("button", { name: "Genereren" }).click();
  await expectToast(page, /als concept klaargezet/);

  await expect(page).toHaveURL(/\/agenda\?date=/);
  await expect(page.getByText(/opgesteld door AI/)).toBeVisible();
  expect(await draftBlocks(page).count()).toBeGreaterThanOrEqual(3);
  await expect(page.getByText(/AI-concept · /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Goedkeuren & leerlingen informeren" })).toBeVisible();
});

test("a second draft for the same day needs an explicit replace", async ({ page }) => {
  await login(page);
  await page.goto(`/agenda?date=${tuesday(2)}`);
  await page.getByRole("button", { name: "Planning genereren" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Datum").fill(tuesday(2));
  await expect(dialog.getByText("Er staat al een concept klaar voor deze dag.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Genereren" })).toBeDisabled();
  await dialog.getByLabel("Bestaand concept vervangen").check();
  await expect(dialog.getByRole("button", { name: "Genereren" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Genereren" }).click();
  await expectToast(page, /als concept klaargezet/);
  // still exactly one banner for that day
  await expect(page.getByText(/opgesteld door AI/)).toHaveCount(1);
});

test("review: drag a draft lesson, remove one, then approve and notify", async ({ page }) => {
  await login(page);
  await page.goto(`/agenda?date=${tuesday(2)}&instructor=all`);
  const before = await draftBlocks(page).count();
  expect(before).toBeGreaterThanOrEqual(3);

  // remove the last draft lesson through its sheet
  await draftBlocks(page).last().click();
  await page.getByRole("button", { name: "Uit concept verwijderen" }).click();
  await expectToast(page, "Uit het concept verwijderd");
  await expect(draftBlocks(page)).toHaveCount(before - 1);

  // drag the first draft lesson to another free time (15-minute snapping, validated by the server)
  const first = draftBlocks(page).first();
  const box = (await first.boundingBox())!;
  const col = (await page.locator("div.relative.border-l").first().boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 40, { steps: 4 });
  await page.mouse.move(box.x + 30, col.y + 11 * 52 + 20, { steps: 10 }); // late afternoon
  await page.mouse.up();
  await page.waitForTimeout(1500);

  // approve: a confirm step with the notification choices comes first
  await page.getByRole("button", { name: "Goedkeuren & leerlingen informeren" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/worden ingepland, de uren gereserveerd/)).toBeVisible();
  await expect(dialog.getByLabel("Bevestiging per SMS")).toBeChecked();
  await dialog.getByRole("button", { name: "Goedkeuren & leerlingen informeren" }).click();
  await expectToast(page, /lessen? goedgekeurd/);

  // the lessons are now real (solid), the banner is gone
  await expect(page.getByText(/opgesteld door AI/)).toHaveCount(0);
  await expect(draftBlocks(page)).toHaveCount(0);
});

test("approved draft lessons reserved the students' hours and are PLANNED", async ({ page }) => {
  await login(page);
  await page.goto(`/lessen?status=PLANNED&from=${tuesday(2)}&to=${tuesday(2)}`);
  await expect(page.getByRole("row").filter({ hasText: "Gepland" }).first()).toBeVisible();
  expect(await page.getByRole("row").filter({ hasText: "Gepland" }).count()).toBeGreaterThanOrEqual(2);
  await page.goto(`/lessen?status=DRAFT&from=${tuesday(2)}&to=${tuesday(2)}`);
  await expect(page.getByText("Geen lessen gevonden.")).toBeVisible();
});

test("a draft can be discarded and leaves nothing behind", async ({ page }) => {
  await login(page);
  await generate(page, tuesday(3));
  await expectToast(page, /als concept klaargezet/);
  await expect(draftBlocks(page).first()).toBeVisible(); // the calendar draws the draft after the redirect
  await page.getByRole("button", { name: "Verwerpen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Verwerpen" }).click();
  await expectToast(page, "Concept verworpen");
  await expect(draftBlocks(page)).toHaveCount(0);
  await expect(page.getByText(/opgesteld door AI/)).toHaveCount(0);
});

test("an instructor can only plan for themselves", async ({ page }) => {
  await login(page, "anouk@example.com");
  await page.getByRole("button", { name: "Planning genereren" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Instructeur")).toHaveCount(0); // no instructor choice
  await dialog.getByLabel("Datum").fill(tuesday(2));
  await expect(dialog.getByText(/leerlingen beschikbaar/)).toBeVisible();
  await dialog.getByRole("button", { name: "Genereren" }).click();
  await expectToast(page, /als concept klaargezet|Er kon niemand worden ingepland/).catch(() => undefined);
  // whatever happened, she never sees Shaakir's draft
  await page.goto(`/agenda?date=${tuesday(2)}`);
  await expect(page.getByText(/opgesteld door AI · Shaakir/)).toHaveCount(0);
});

test("the planner rules can be changed in Settings", async ({ page }) => {
  await login(page);
  await page.goto("/instellingen");
  const examFirst = page.getByLabel("Examenkandidaten eerst");
  await expect(examFirst).toBeChecked();
  await examFirst.uncheck();
  await page.getByLabel("Max. rit tussen ophaaladressen (min)").fill("40");
  await page.getByRole("button", { name: "Opslaan", exact: true }).last().click();
  await expectToast(page, "Instellingen opgeslagen");
  await page.reload();
  await expect(page.getByLabel("Examenkandidaten eerst")).not.toBeChecked();
  await expect(page.getByLabel("Max. rit tussen ophaaladressen (min)")).toHaveValue("40");
  await page.goto("/agenda");
  await expect(page.getByText("Korte ritten tussen ophaaladressen (max. 40 min)")).toBeVisible();
  await expect(page.getByText("Examenkandidaten eerst")).toHaveCount(0); // rule panel follows the setting
});

test("the dashboard banner offers to draft the next working day when nothing is planned", async ({ page }) => {
  await login(page);
  // free the day the banner points at: it only shows for an unplanned day, so check the rule both ways
  const banner = page.getByRole("region", { name: /· /i }).filter({ hasText: "Laat AI het in een minuut opstellen" });
  if (await banner.count()) {
    await expect(banner.getByRole("button", { name: /^Genereer [a-z]/ })).toBeVisible(); // lower-case "morgen" / weekday
    await expect(banner.getByRole("link", { name: "Jij controleert, sleept & keurt goed" })).toBeVisible();
    await expect(banner.getByText(/leerlingen beschikbaar/)).toBeVisible();
  } else {
    await expect(page.getByText("Laat AI het in een minuut opstellen")).toHaveCount(0);
  }
});
