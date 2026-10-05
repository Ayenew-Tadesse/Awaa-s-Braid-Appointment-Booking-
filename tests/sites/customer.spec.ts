import { expect, test, type Page } from "@playwright/test";

// The customer website: customers sign in and sign up; nothing of the demo or the staff.
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

test("the front page is the real salon's: no demo note", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Beautiful braids, booked in a minute");
  await expect(page.getByText("This is a demo")).toHaveCount(0);
  await noSideScroll(page);
});

test("customers sign in, with a link to create an account; no demo, tour or staff doors", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.locator("[data-sign-in] #email")).toBeVisible();
  for (const sel of ["[data-demo]", "[data-tour-start]", "[data-staff-doors]"]) await expect(page.locator(sel)).toHaveCount(0);
  await expect(page.getByText(/demo|staff/i)).toHaveCount(0);
  await noSideScroll(page);
  await page.click("[data-to-signup]");
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { level: 1, name: "Create an account" })).toBeVisible();
  for (const id of ["#name", "#phone", "#email", "#password"]) await expect(page.locator(`[data-sign-up] ${id}`)).toBeVisible();
  await expect(page.getByText("Ask to join the team")).toHaveCount(0);
  await noSideScroll(page);
});

test("the staff pages don't exist here", async ({ page }) => {
  for (const path of ["/login/admin", "/login/stylist"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("[data-sign-in]")).toBeVisible();
  }
});

test("a short password is refused before anything is sent", async ({ page }) => {
  await page.goto("/signup");
  await page.fill("#name", "Test Person");
  await page.fill("#email", "someone@example.com");
  await page.fill("#password", "short");
  await page.click("[data-sign-up] button[type=submit]");
  await expect(page.locator("[data-sign-up] [role=alert]")).toContainText("at least 8 characters");
});
