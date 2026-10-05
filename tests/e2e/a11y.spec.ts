import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Every main screen, checked with axe (WCAG 2.1 A and AA) in light and dark:
// no serious or critical problems (contrast, names, labels, structure).
const scan = async (page: Page, where: string) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${where}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, bad.join("\n")).toEqual([]);
};

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    test.skip(({ viewport }) => (viewport?.width ?? 0) !== 390, "one phone width is enough for these scans");

    test("visitor and customer screens", async ({ page }) => {
      await page.goto("/");
      await page.waitForSelector("[data-style]");
      await scan(page, "front page");
      await page.goto("/login");
      await scan(page, "sign in");
      await page.click("[data-demo=customer]");
      await page.waitForSelector("[data-next]");
      await scan(page, "customer home");
      await page.goto("/app/book");
      await page.click('[data-pick-style="Knotless braids"]');
      await scan(page, "booking: options");
      await page.click('[data-option="Medium"]');
      await page.click('[data-option="Shoulder"]');
      await page.click("[data-next]");
      await page.waitForSelector("[data-slots] button, [data-days] button");
      await scan(page, "booking: time");
      for (const path of ["/app/styles", "/app/notifications", "/app/account"]) {
        await page.goto(path);
        await page.waitForSelector("main h1");
        await scan(page, path);
      }
    });

    test("salon screens", async ({ page }) => {
      await page.goto("/login");
      await page.click("[data-demo=admin]");
      await page.waitForSelector("[data-admin-stats]");
      await scan(page, "today");
      await page.locator("[data-requests] [data-appointment]").first().click();
      await page.waitForSelector("[data-sheet]");
      await scan(page, "appointment sheet");
      await page.keyboard.press("Escape");
      for (const path of ["/app/calendar", "/app/salon", "/app/salon/styles", "/app/salon/team", "/app/salon/reports", "/app/notifications"]) {
        await page.goto(path);
        await page.waitForSelector("main h1");
        await scan(page, path);
      }
      await page.goto("/app/salon/styles");
      await page.locator("[data-manage-style]").first().click();
      await page.waitForSelector("[data-style-editor]");
      await scan(page, "style editor");
    });
  });
}
