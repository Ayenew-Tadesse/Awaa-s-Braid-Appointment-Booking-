import { expect, test, type Page } from "@playwright/test";

// Nothing may scroll sideways, at any width.
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

test("the front page explains the salon, lists styles with prices, and leads to booking", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Beautiful braids, booked in a minute");
  await expect(page.locator("[data-style]")).toHaveCount(7);
  await expect(page.locator('[data-style="Knotless braids"]')).toContainText("From ETB 2,200");
  await expect(page.getByText("You pay at the salon on the day.")).toBeVisible();
  await expect(page.getByText("This is a demo with a fictional salon and fictional people.")).toBeVisible();
  await noSideScroll(page);
  await page.locator("[data-cta-book]").click();
  await expect(page).toHaveURL(/\/login$/);
});

test("a customer sees only their own appointments, upcoming and past", async ({ page }) => {
  await page.goto("/login");
  await page.click("[data-demo=customer]");
  await expect(page.getByRole("heading", { name: "Hello, Hana" })).toBeVisible();
  await expect(page.locator("[data-next]")).toContainText("Knotless braids");
  await expect(page.locator("[data-next]")).toContainText("Pay at the salon: ETB");
  const upcoming = page.locator("[role=tabpanel] [data-appointment]");
  await expect(upcoming).toHaveCount(2);
  await page.click("[data-tab=past]");
  await expect(upcoming).toHaveCount(2);
  await expect(page.locator("[role=tabpanel]")).toContainText("Done");
  // No other customer's name anywhere.
  for (const other of ["Liya Tesfaye", "Ruth Alemu", "Saba Girma", "Bethlehem Haile"]) await expect(page.getByText(other)).toHaveCount(0);
  await noSideScroll(page);
});

test("the salon admin sees today's diary, requests and the week", async ({ page }) => {
  await page.goto("/login");
  await page.click("[data-demo=admin]");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.locator("[data-admin-stats]")).toContainText("Requests to confirm");
  await expect(page.locator("[data-today-list] [data-appointment]").first()).toBeVisible();
  await expect(page.locator("[data-requests] [data-appointment]").first()).toBeVisible();
  // The salon sees who is coming, with their phone number.
  await expect(page.locator("[data-requests] a[href^='tel:']").first()).toBeVisible();
  await noSideScroll(page);
});

test("tabs, styles, account and signing out", async ({ page }, info) => {
  await page.goto("/login");
  await page.click("[data-demo=customer]");
  await expect(page.getByRole("heading", { name: "Hello, Hana" })).toBeVisible();
  const phone = (page.viewportSize()?.width ?? 0) < 640;
  // Phones: a tab bar at the bottom; wider screens: the tabs sit in the top bar.
  await expect(page.locator("[data-tabbar]")).toBeVisible({ visible: phone });
  const nav = phone ? page.locator("[data-tabbar]") : page.locator("header nav");
  await nav.getByRole("link", { name: "Styles" }).click();
  await expect(page.getByRole("heading", { name: "Styles and prices" })).toBeVisible();
  await expect(page.locator("[data-style]")).toHaveCount(7);
  await noSideScroll(page);
  await nav.getByRole("link", { name: "Account" }).click();
  await expect(page.locator("[data-me]")).toHaveText("Hana Bekele");
  await page.click("[data-sign-out]");
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  // Signed out: the app sends you back to sign in.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  expect(info.project.name).toBeTruthy();
});

test("the demo password works in the form; a wrong one doesn't", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "nope");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("That email and password don't match.");
  await page.fill("#password", "demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
});
