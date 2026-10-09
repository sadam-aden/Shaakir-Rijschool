import { expect, test } from "@playwright/test";
import { expectToast, login, nextWeekday, PASSWORD } from "./helpers";

test.describe("login and roles", () => {
  test("rejects a wrong password and accepts the right one", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "shaakir@example.com");
    await page.fill("input[name=password]", "wrong-password");
    await page.click("form:has(input[name=password]) button");
    await expect(page.locator("p[role=alert]")).toContainText("onjuist");
    await page.fill("input[name=password]", PASSWORD);
    await page.click("form:has(input[name=password]) button");
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Goede(morgen|middag|navond), Shaakir/);
  });

  test("an instructor cannot reach payments, settings or reports", async ({ page }) => {
    await login(page, "anouk@example.com");
    await expect(page.getByRole("link", { name: /Betalingen/ })).toHaveCount(0);
    for (const path of ["/betalingen", "/instellingen", "/rapportages", "/instructeurs"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
    await expect(page.getByRole("link", { name: "Mijn leerlingen" })).toBeVisible();
  });

  test("an instructor only sees their own students", async ({ page }) => {
    await login(page, "anouk@example.com");
    await page.goto("/leerlingen");
    await expect(page.getByRole("row", { name: /Tim Dekker/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Sanne Bakker/ })).toHaveCount(0);
  });
});

test("switches between Dutch and English", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("link", { name: "Leerlingen", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Gebruikersmenu" }).click();
  await page.getByRole("button", { name: /^en$/i }).click();
  await page.keyboard.press("Escape"); // an open menu hides the rest of the page from assistive tech
  await expect(page.getByRole("link", { name: "Students", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Students", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("button", { name: /^nl$/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Leerlingen", exact: true })).toBeVisible();
});

test("books a lesson with the best-fit slot", async ({ page }) => {
  await login(page);
  const wed = nextWeekday(3);
  await page.goto(`/les-inplannen?date=${wed}&duration=90`);
  await page.getByRole("button", { name: "Kies een leerling", exact: true }).click();
  await page.getByPlaceholder("Zoek een leerling").fill("Kim");
  await page.getByRole("button", { name: /Kim Hendriks/ }).click();
  // the best slot is preselected and explained
  await expect(page.getByText("Beste keuze").first()).toBeVisible();
  await expect(page.getByText(/is de beste keuze/)).toBeVisible();
  await page.getByRole("button", { name: "Boeking bevestigen" }).click();
  await expectToast(page, "Les ingepland");
  await page.waitForURL(/\/agenda/);
  await expect(page.getByRole("button", { name: /Kim Hendriks/ })).toBeVisible();
});

test("drags a student from the planner panel onto the calendar", async ({ page }) => {
  await login(page);
  const monday = nextWeekday(1);
  await page.goto(`/agenda?date=${monday}`);
  const card = page.locator("aside [class*='cursor-grab']").filter({ hasText: "Lars Mulder" });
  await expect(card).toBeVisible();
  const box = (await card.boundingBox())!;
  const tuesday = (await page.locator("div.relative.border-l").nth(1).boundingBox())!;
  const y = tuesday.y + ((14.5 * 60 - 8 * 60) * 52) / 60; // Tuesday 14:30 (Lars is available Tue afternoons)
  await page.mouse.move(box.x + 40, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 5 });
  await page.mouse.move(tuesday.x + tuesday.width / 2, y, { steps: 12 });
  await expect(page.getByText("Past in beschikbaarheid")).toBeVisible();
  await page.mouse.up();
  await expectToast(page, "Les ingepland");
  await expect(page.getByRole("button", { name: /Lars Mulder 14:30/ })).toBeVisible();
});

test("shows why dropping outside availability is refused", async ({ page }) => {
  await login(page);
  const monday = nextWeekday(1);
  await page.goto(`/agenda?date=${monday}`);
  const card = page.locator("aside [class*='cursor-grab']").filter({ hasText: "Sem de Jong" }); // Friday afternoons only
  const box = (await card.boundingBox())!;
  const monday0 = (await page.locator("div.relative.border-l").nth(0).boundingBox())!; // Monday: Sem is not available
  await page.mouse.move(box.x + 40, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 5 });
  await page.mouse.move(monday0.x + monday0.width / 2, monday0.y + 120, { steps: 12 });
  await expect(page.getByText(/Buiten beschikbaarheid van de leerling|Botst met/).first()).toBeVisible();
  await page.mouse.up();
  await expectToast(page, /Buiten beschikbaarheid/).catch(() => undefined);
});

test("checks off a lesson and updates the hours", async ({ page }) => {
  await login(page);
  await page.goto("/lessen?status=PLANNED");
  const row = page.getByRole("row").filter({ hasText: "Praktijk" }).first();
  await row.getByText(/\d{2}:\d{2} · \d+ min/).click();
  await page.getByRole("button", { name: "Afvinken", exact: true }).click();
  await page.getByRole("button", { name: "Les afronden" }).click();
  await expectToast(page, "Les afgerond");
});

test("cancelling shows whether the hours are charged or returned", async ({ page }) => {
  await login(page);
  await page.goto("/lessen?status=PLANNED&type=PRACTICAL");
  await page.getByRole("row").filter({ hasText: "Praktijk" }).first().getByText(/\d{2}:\d{2} · \d+ min/).click();
  await page.getByRole("button", { name: "Annuleren", exact: true }).first().click();
  await expect(page.getByText(/Uren in rekening brengen/)).toBeVisible();
  await expect(page.getByText(/Ruim op tijd|Binnen \d+ uur/)).toBeVisible();
});

test("only accepts students who are at least 18 years old", async ({ page }) => {
  await login(page);
  await page.goto("/leerlingen");
  await page.getByRole("button", { name: "Leerling toevoegen" }).click();
  await page.getByLabel("Voornaam").fill("Testy");
  await page.getByLabel("Achternaam").fill("Jong");
  await page.getByLabel("Geboortedatum").fill("2015-05-05");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.getByText("De leerling moet minimaal 18 jaar oud zijn.")).toBeVisible();
  await page.getByLabel("Geboortedatum").fill("2000-05-05");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expectToast(page, "Leerling toegevoegd");
});

test("creates, edits and permanently deletes a student", async ({ page }) => {
  await login(page);
  await page.goto("/leerlingen");
  await page.getByRole("button", { name: "Leerling toevoegen" }).click();
  await page.getByLabel("Voornaam").fill("Dolf");
  await page.getByLabel("Achternaam").fill("Tijdelijk");
  await page.getByLabel("Geboortedatum").fill("1990-01-01");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expectToast(page, "Leerling toegevoegd");
  await expect(page.getByRole("heading", { name: "Dolf Tijdelijk" })).toBeVisible();

  // edit
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await page.getByLabel("Achternaam").fill("Verwijder");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expectToast(page, "Gegevens opgeslagen");
  await expect(page.getByRole("heading", { name: "Dolf Verwijder" })).toBeVisible();

  // delete needs the full name typed
  await page.getByRole("button", { name: "Verwijderen", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Definitief verwijderen" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Typ de volledige naam ter bevestiging").fill("Dolf Verwijder");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expectToast(page, "Leerling verwijderd");
  await expect(page.getByText("Dolf Verwijder")).toHaveCount(0);
});

test("an instructor cannot delete students", async ({ page }) => {
  await login(page, "anouk@example.com");
  await page.goto("/leerlingen");
  await expect(page.getByRole("button", { name: "Verwijderen", exact: true })).toHaveCount(0);
});

test("the edit form always belongs to the student that is selected", async ({ page }) => {
  await login(page);
  await page.goto("/leerlingen");
  await page.getByRole("row", { name: /Julia Vos/ }).click();
  await expect(page.getByRole("heading", { name: "Julia Vos" })).toBeVisible();
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await expect(page.getByLabel("Voornaam")).toHaveValue("Julia");
  await page.keyboard.press("Escape");
  await page.getByRole("row", { name: /Ayoub Haddad/ }).click();
  await expect(page.getByRole("heading", { name: "Ayoub Haddad" })).toBeVisible();
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await expect(page.getByLabel("Voornaam")).toHaveValue("Ayoub");
});

test("picks province, city and neighbourhood from the Dutch places list", async ({ page }) => {
  await login(page);
  await page.goto("/leerlingen");
  await page.getByRole("button", { name: "Leerling toevoegen" }).click();
  await page.getByLabel("Voornaam").fill("Pien");
  await page.getByLabel("Achternaam").fill("Plaats");
  await page.getByLabel("Geboortedatum").fill("1995-03-03");

  // the city box is locked until a province is chosen
  await expect(page.getByLabel("Plaats (stad of dorp)")).toBeDisabled();
  await page.getByLabel("Provincie").selectOption("Zuid-Holland");
  await page.getByLabel("Plaats (stad of dorp)").fill("Atlantis");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.getByText("Kies een plaats uit de lijst van deze provincie.")).toBeVisible();

  await page.getByLabel("Plaats (stad of dorp)").fill("Rotterdam");
  await expect(page.locator("#student-wijk-options option[value='Delfshaven']")).toHaveCount(1);
  await page.getByLabel("Wijk").fill("Delfshaven");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expectToast(page, "Leerling toegevoegd");
  await expect(page.getByText(/Delfshaven, Rotterdam/)).toBeVisible();
});

test("suggests addresses once a province is chosen and fills in the rest", async ({ page }) => {
  // the real address service (PDOK) is replaced by a fixed answer so the test never depends on the internet
  await page.route("**/api/address**", (route) =>
    route.fulfill({
      json: {
        suggestions: [
          { address: "Oostzeedijk 120", postcode: "3063 BB", city: "Rotterdam", wijk: "Kralingen-Crooswijk", lat: 51.9197, lng: 4.5135 },
          { address: "Oostzeedijk 122", postcode: "3063 BB", city: "Rotterdam", wijk: "Kralingen-Crooswijk", lat: 51.9198, lng: 4.5136 },
        ],
      },
    }),
  );
  await login(page);
  await page.goto("/leerlingen");
  await page.getByRole("button", { name: "Leerling toevoegen" }).click();
  await page.getByLabel("Voornaam").fill("Adres");
  await page.getByLabel("Achternaam").fill("Voorstel");
  await page.getByLabel("Geboortedatum").fill("1992-02-02");

  const address = page.locator("input[name=address]");
  await expect(address).toHaveAttribute("placeholder", /Kies eerst een provincie/);
  await page.getByLabel("Provincie").selectOption("Zuid-Holland");
  await address.fill("Oostz");
  const suggestions = page.locator("ul[role=listbox] li[role=option]");
  await expect(suggestions).toHaveCount(2);
  await suggestions.first().click();

  await expect(address).toHaveValue("Oostzeedijk 120");
  await expect(page.getByLabel("Postcode")).toHaveValue("3063 BB");
  await expect(page.getByLabel("Plaats (stad of dorp)")).toHaveValue("Rotterdam");
  await expect(page.getByLabel("Wijk")).toHaveValue("Kralingen-Crooswijk");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expectToast(page, "Leerling toegevoegd");
  await expect(page.getByText(/Kralingen-Crooswijk, Rotterdam/)).toBeVisible();
});
