import { expect, test } from "@playwright/test";
import { expectToast, login, nextWeekday } from "./helpers";

const row = (page: import("@playwright/test").Page, name: RegExp) => page.getByRole("row", { name });


/** Opens the Payments tab of a student, waiting for each step so the right student is shown. */
async function openStudentPayments(page: import("@playwright/test").Page, name: string) {
  await page.goto("/leerlingen");
  await page.getByRole("row", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  await page.getByRole("link", { name: "Volledig profiel" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("link", { name: "Betalingen", exact: true }).click();
  await expect(page).toHaveURL(/tab=payments/);
}

test.describe.configure({ mode: "serial" });

test("the payments page shows the balances with the right status and action", async ({ page }) => {
  await login(page);
  await page.goto("/betalingen");
  await expect(page.getByText("Ontvangen deze maand")).toBeVisible();
  await expect(row(page, /Yusuf Demir/)).toContainText(/Te laat · \d+ dgn/);
  await expect(row(page, /Yusuf Demir/).getByRole("button", { name: "Stuur herinnering" })).toBeVisible();
  await expect(row(page, /Fatima Ouali/)).toContainText("Deels betaald");
  await expect(row(page, /Fatima Ouali/).getByRole("button", { name: "Stuur iDEAL-link" })).toBeVisible();
  await expect(row(page, /Emma Visser/)).toContainText("Betaald");
  await page.getByRole("link", { name: "Onbetaald" }).click();
  await expect(row(page, /Emma Visser/)).toHaveCount(0);
  await expect(row(page, /Yusuf Demir/)).toBeVisible();
});

test("an instructor cannot reach the money pages or exports", async ({ page }) => {
  await login(page, "anouk@example.com");
  await page.goto("/betalingen");
  await expect(page).toHaveURL("/");
  expect((await page.request.get("/api/export/accountant")).status()).toBe(403);
});

test("the booking wizard blocks a student with an overdue invoice until an admin overrides it", async ({ page }) => {
  await login(page);
  await page.goto(`/les-inplannen?date=${nextWeekday(3)}`);
  await page.getByRole("button", { name: "Kies een leerling", exact: true }).click();
  await page.getByPlaceholder("Zoek een leerling").fill("Yusuf");
  await page.getByRole("button", { name: /Yusuf Demir/ }).click();
  await expect(page.getByText("Er staat een te late factuur open").first()).toBeVisible();
  await expect(page.getByText("Beste keuze")).toHaveCount(0);

  await page.getByText("Overschrijven (beheerder)").click();
  await page.getByLabel("Boeken ondanks een te late factuur").check();
  await page.getByLabel("Reden (verplicht)").fill("Betaalt vrijdag contant");
  await expect(page.getByText("Beste keuze").first()).toBeVisible();
  await page.getByRole("button", { name: "Boeking bevestigen" }).click();
  await expectToast(page, "Les ingepland");
});

test("sends all reminders after a confirmation list and records them on the invoice", async ({ page }) => {
  await login(page);
  await page.goto("/betalingen");
  await page.getByRole("button", { name: "Alle herinneringen versturen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Yusuf Demir")).toBeVisible();
  await expect(dialog.getByText("Bram Peters")).toBeVisible();
  await expect(dialog.getByText("Emma Visser")).toHaveCount(0); // paid in full: no reminder
  await dialog.getByRole("button", { name: /^Versturen/ }).click();
  await expectToast(page, /herinneringen verstuurd/);

  // nobody is reminded twice within 24 hours
  await page.getByRole("button", { name: "Alle herinneringen versturen" }).click();
  await expect(page.getByRole("dialog").getByText(/zonder recente herinnering/)).toBeVisible();
  await page.keyboard.press("Escape");

});

test("records a manual payment, refuses over-payment and settles the invoice", async ({ page }) => {
  await login(page);
  await page.goto("/betalingen");
  await row(page, /Bram Peters/).getByRole("button", { name: "Stuur herinnering" }).waitFor();
  // open Bram's invoice through the student profile
  await openStudentPayments(page, "Bram Peters");
  await page.locator("a[href^='/betalingen/facturen/']").first().click();
  await expect(page.getByText("Nog te betalen").first()).toBeVisible();

  await page.getByRole("button", { name: "Als betaald markeren" }).click();
  await page.getByLabel("Bedrag (€)").fill("99999");
  await page.getByRole("button", { name: "Vastleggen" }).click();
  // errors are announced as an alert (role=alert), unlike success messages (role=status)
  await expect(page.getByRole("alert").filter({ hasText: "hoger dan wat nog openstaat" })).toBeVisible();

  // pay what is owed (the field is pre-filled with the outstanding amount)
  await page.getByLabel("Bedrag (€)").fill("350");
  await page.getByRole("button", { name: "Vastleggen" }).click();
  await expectToast(page, "Betaling vastgelegd");
  await expect(page.getByText("Betaald").first()).toBeVisible();
});

test("pays an iDEAL link through the mock checkout and the invoice turns paid", async ({ page }) => {
  await login(page);
  await page.goto("/betalingen");
  await row(page, /Fatima Ouali/).getByRole("button", { name: "Stuur iDEAL-link" }).click();
  await expectToast(page, "iDEAL-link verstuurd");

  await openStudentPayments(page, "Fatima Ouali");
  await page.locator("a[href^='/betalingen/facturen/']").first().click();

  const link = page.getByRole("link", { name: "Betaallink openen" });
  await expect(link).toBeVisible();
  await page.goto((await link.getAttribute("href"))!);
  await expect(page.getByText("iDEAL (test)")).toBeVisible();
  await page.getByRole("button", { name: "Betaling slaagt" }).click();
  await expect(page.getByRole("heading", { name: "Betaling gelukt" })).toBeVisible();

  // idempotent: opening the return page again changes nothing
  await page.reload();
  await expect(page.getByRole("heading", { name: "Betaling gelukt" })).toBeVisible();

  await page.goBack();
  await page.goto("/betalingen");
  await expect(row(page, /Fatima Ouali/)).toContainText("Betaald");
});

test("selling a package creates a numbered invoice with a downloadable PDF", async ({ page }) => {
  await login(page);
  await openStudentPayments(page, "Kim Hendriks");
  await page.getByRole("button", { name: "Pakket toevoegen" }).click();
  await page.getByLabel("Kies een pakket").selectOption({ label: "20 lessen" });
  await page.getByRole("button", { name: "Bevestigen" }).click();
  await expectToast(page, "Opgeslagen");

  const invoiceLink = page.locator("a[href^='/betalingen/facturen/']").last();
  await expect(invoiceLink).toContainText(/\d{4}-\d{4}/);
  await invoiceLink.click();
  await expect(page.getByText(/1\.150,00/).first()).toBeVisible();
  const href = await page.getByRole("link", { name: "PDF downloaden" }).getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("the dashboard top-up button sells a package and sends the link", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Bijna door uren heen")).toBeVisible();
  await page.getByRole("button", { name: "Stuur aanvulling" }).first().click();
  await page.getByRole("button", { name: "Factuur + link versturen" }).click();
  await expectToast(page, /Aanvulling verstuurd \(factuur \d{4}-\d{4}\)/);
});

test("the accountant export is a semicolon CSV with a BOM", async ({ page }) => {
  await login(page);
  const r = await page.request.get("/api/export/accountant");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("text/csv");
  const text = await r.text();
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text.split("\r\n")[0]).toContain("Factuurnummer;Factuurdatum");
  expect(text).toContain("Yusuf Demir");
});

test("the cron endpoint needs its secret, and the Mollie webhook ignores unknown ids", async ({ request }) => {
  expect((await request.get("/api/cron/run")).status()).toBe(401);
  expect((await request.get("/api/cron/run", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  const ok = await request.get("/api/cron/run", { headers: { Authorization: "Bearer e2e-cron-secret" } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body).toHaveProperty("notifications");
  expect(body.schools[0]).toHaveProperty("ledger");

  const hook = await request.post("/api/webhooks/mollie", { form: { id: "tr_doesNotExist" } });
  expect(hook.status()).toBe(200);
  expect((await request.post("/api/webhooks/mollie", { form: { id: "garbage" } })).status()).toBe(200);
});

test("Settings can run the background jobs on demand", async ({ page }) => {
  await login(page);
  await page.goto("/instellingen");
  await page.getByRole("button", { name: "Nu uitvoeren" }).click();
  await expectToast(page, /Klaar:/);
});
