import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const pages = ["/", "/agenda", "/leerlingen", "/les-inplannen", "/lessen", "/betalingen", "/rapportages", "/instructeurs", "/lesautos", "/pakketten", "/instellingen"];

test.describe("phone width (390px)", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("no page scrolls sideways", async ({ page }) => {
    await login(page);
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }));
      expect(sw, `${p} is wider than the screen`).toBeLessThanOrEqual(vw);
    }
  });

  test("the menu opens as a drawer, navigates and closes", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Menu openen" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Betalingen" }).click();
    await page.waitForURL(/betalingen/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
