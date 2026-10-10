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
      const { sw, vw, wide } = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > vw + 1 && !el.closest("[class*='overflow-x-auto']"))
          .slice(0, 5)
          .map((el) => `<${el.tagName.toLowerCase()} class="${String(el.getAttribute("class")).slice(0, 80)}"> right=${Math.round(el.getBoundingClientRect().right)}`);
        return { sw: document.documentElement.scrollWidth, vw, wide };
      });
      expect(sw, `${p} is wider than the screen: ${wide.join(" | ")}`).toBeLessThanOrEqual(vw);
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
