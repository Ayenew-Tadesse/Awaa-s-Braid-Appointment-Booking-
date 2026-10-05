import { expect, test, type Page } from "@playwright/test";

// The guided demo tour: eight stops, customer then salon, at every width.
const card = (page: Page) => page.getByRole("dialog", { name: /./ }).filter({ has: page.locator("[data-tour-next]") });
const stepLine = (page: Page) => card(page).locator("p").first();

test("the tour walks through the customer's and the salon's side, and ends", async ({ page }) => {
  await page.goto("/login");
  await page.click("[data-tour-start]");
  await expect(stepLine(page)).toHaveText(/Step 1 of 8 · Customer/);
  await expect(page.locator("#tour-title")).toHaveText("Your next appointment");
  await expect(page.locator("[data-tour-highlight]")).toBeVisible();
  await expect(page.locator("[data-tour-back]")).toBeDisabled();
  await expect(page.locator("[data-tour-next]")).toBeFocused();

  const expected = [
    ["2", "Customer", "/app/book"], ["3", "Customer", "/app/notifications"],
    ["4", "Salon admin", "/app"], ["5", "Salon admin", "/app/calendar"], ["6", "Salon admin", "/app/salon/styles"],
    ["7", "Salon admin", "/app/salon/team"], ["8", "Salon admin", "/app/salon/reports"],
  ];
  for (const [n, role, path] of expected) {
    await page.click("[data-tour-next]");
    await expect(stepLine(page)).toHaveText(new RegExp(`Step ${n} of 8 · ${role}`));
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
    await expect(page.locator("[data-tour-highlight]")).toBeVisible();
    // The card is always fully on screen, and nothing scrolls sideways.
    const box = await card(page).boundingBox(), vp = page.viewportSize()!;
    expect(box!.y >= 0 && box!.y + box!.height <= vp.height && box!.x >= 0 && box!.x + box!.width <= vp.width, `stop ${n}`).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `stop ${n}`).toBe(true);
  }
  await expect(page.locator("[data-tour-next]")).toHaveText("Finish");
  await page.click("[data-tour-back]");
  await expect(stepLine(page)).toHaveText(/Step 7 of 8/);
  await page.click("[data-tour-next]");
  await page.click("[data-tour-next]");
  await expect(page.locator("[data-tour-overlay]")).toHaveCount(0);
  await expect(page.getByText("That's the tour.")).toBeVisible();
});

test("the tour can be ended early, or with Escape", async ({ page }) => {
  await page.goto("/login");
  await page.click("[data-tour-start]");
  await expect(stepLine(page)).toHaveText(/Step 1 of 8/);
  await page.click("[data-tour-end]");
  await expect(page.locator("[data-tour-overlay]")).toHaveCount(0);
  await page.goto("/login");
  await page.click("[data-tour-start]");
  await expect(stepLine(page)).toHaveText(/Step 1 of 8/);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-tour-overlay]")).toHaveCount(0);
});

test("the tour speaks Amharic", async ({ page }, info) => {
  test.skip(info.project.name !== "w390", "one width is enough");
  await page.goto("/login");
  await page.getByRole("button", { name: "አማርኛ" }).click();
  await page.click("[data-tour-start]");
  await expect(page.locator("#tour-title")).toHaveText("የሚቀጥለው ቀጠሮዎ");
  await expect(stepLine(page)).toHaveText(/ደረጃ 1 ከ8 · ደንበኛ/);
});
