import { expect, test, type Page } from "@playwright/test";

// The staff website: the salon admin and stylists; no front page, no demo, not listed by search engines.
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

test("opens on the staff sign-in with two doors, and asks search engines not to list it", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Staff sign in" })).toBeVisible();
  await expect(page.locator("[data-door]")).toHaveCount(2);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  for (const sel of ["[data-demo]", "[data-tour-start]"]) await expect(page.locator(sel)).toHaveCount(0);
  await noSideScroll(page);
});

test("the salon admin signs in; there is no admin sign-up", async ({ page }) => {
  await page.goto("/login");
  await page.click('[data-door="/login/admin"]');
  await expect(page.getByRole("heading", { level: 1, name: "Salon admin" })).toBeVisible();
  await expect(page.locator("[data-sign-in] #email")).toBeVisible();
  await expect(page.locator("[data-to-signup]")).toHaveCount(0);
  await expect(page.getByText("Admin accounts are set up by the salon owner.")).toBeVisible();
});

test("a stylist signs in, or asks to join the team", async ({ page }) => {
  await page.goto("/login");
  await page.click('[data-door="/login/stylist"]');
  await expect(page.getByRole("heading", { level: 1, name: "I'm a stylist" })).toBeVisible();
  await page.click("[data-to-signup]");
  await expect(page.getByRole("heading", { level: 1, name: "Join the team" })).toBeVisible();
  await expect(page.locator("[data-sign-up] button[type=submit]")).toHaveText("Ask to join the team");
  await noSideScroll(page);
});
