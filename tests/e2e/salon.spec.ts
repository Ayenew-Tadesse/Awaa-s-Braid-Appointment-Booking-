import { expect, test, type Page } from "@playwright/test";

const signIn = async (page: Page, who: "admin" | "customer") => {
  await page.goto("/login");
  await page.click(`[data-demo=${who}]`);
  await expect(page.getByRole("heading", { name: who === "admin" ? "Today" : "Hello, Hana", level: 1 })).toBeVisible();
};
const switchTo = async (page: Page, who: "admin" | "customer") => {
  await page.goto("/app/account");
  await page.click("[data-sign-out]");
  await page.click(`[data-demo=${who}]`);
};
const tab = (page: Page, name: string) => ((page.viewportSize()?.width ?? 0) < 640 ? page.locator("[data-tabbar]") : page.locator("header nav")).getByRole("link", { name });
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

test("confirm a request: the customer then sees it confirmed", async ({ page }) => {
  await signIn(page, "admin");
  const hana = page.locator("[data-requests] [data-appointment]", { hasText: "Hana Bekele" });
  await hana.click();
  const sheet = page.locator("[data-sheet]");
  await expect(sheet).toContainText("Passion twists");
  await expect(sheet.getByRole("link", { name: "Call Hana" })).toHaveAttribute("href", /^tel:/);
  await noSideScroll(page);
  await sheet.locator("[data-action=confirm]").click();
  await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await expect(page.locator("[data-requests] [data-appointment]", { hasText: "Hana Bekele" })).toHaveCount(0);
  await switchTo(page, "customer");
  await expect(page.locator("[role=tabpanel] [data-appointment]", { hasText: "Passion twists" })).toContainText("Confirmed");
});

test("decline a request (after a check); it shows as cancelled for the customer", async ({ page }) => {
  await signIn(page, "admin");
  await page.locator("[data-requests] [data-appointment]", { hasText: "Hana Bekele" }).click();
  await page.locator("[data-sheet] [data-action=decline]").click();
  await expect(page.getByRole("alertdialog")).toContainText("Decline this request?");
  await page.click("[data-confirm-cancel]");
  await expect(page.locator("[data-requests] [data-appointment]", { hasText: "Hana Bekele" })).toHaveCount(0);
  await switchTo(page, "customer");
  await page.click("[data-tab=past]");
  await expect(page.locator("[role=tabpanel] [data-appointment]", { hasText: "Passion twists" })).toContainText("Cancelled");
});

test("move a request to another free time and stylist", async ({ page }) => {
  await signIn(page, "admin");
  const card = page.locator("[data-requests] [data-appointment]", { hasText: "Hana Bekele" });
  await card.click();
  await page.locator("[data-sheet] [data-action=reschedule]").click();
  await expect(page.locator("[data-sheet]")).toContainText("Only times when the stylist is free, with 1 h to travel between homes, are shown.");
  await page.click('[data-move-stylist="Selam"]');
  await page.locator("[data-move-days] button").nth(10).click();
  const slot = page.locator("[data-move-slots] button").first();
  const time = await slot.innerText();
  await slot.click();
  await noSideScroll(page);
  await page.click("[data-move-save]");
  await expect(page.locator("[data-sheet]")).toHaveCount(0);
  await expect(card).toContainText(time);
  await expect(card).toContainText("with Selam");
});

test("the calendar: each stylist's day, the next day, and the week", async ({ page }) => {
  await signIn(page, "admin");
  await tab(page, "Calendar").click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.locator("[data-cal-stylist]")).toHaveCount(3);
  const first = await page.locator("[data-cal-date]").innerText();
  await page.click("[data-next-day]");
  await expect(page.locator("[data-cal-date]")).not.toHaveText(first);
  await page.click("[data-today]");
  await page.click("[data-view-tab=week]");
  await expect(page.locator("[data-week] li")).toHaveCount(7);
  await noSideScroll(page);
  await page.locator("[data-week-day]").nth(3).click();
  await expect(page.locator("[data-calendar]")).toHaveAttribute("data-view", "day");
});

test("add a style with options; customers can book it; hide it and it's gone for them", async ({ page }) => {
  await signIn(page, "admin");
  await tab(page, "Salon").click();
  await page.click('[data-salon-link="/app/salon/styles"]');
  await page.click("[data-add-style]");
  await page.fill("#st-name", "Goddess locs");
  await page.selectOption("#st-cat", "locs");
  await page.fill("#st-min", "300");
  await page.fill("#st-price", "260");
  await page.click("[data-add-option]");
  const row = page.locator("[data-option-row]").first();
  await row.locator("select").selectOption("length");
  await row.getByLabel("Label").fill("Waist");
  await row.getByLabel("+ $").fill("50");
  await noSideScroll(page);
  await page.click("[data-save-style]");
  await expect(page.locator('[data-manage-style="Goddess locs"]')).toContainText("$260");
  // The customer sees it, and booking asks for its length.
  await switchTo(page, "customer");
  await page.goto("/app/book");
  await page.click('[data-pick-style="Goddess locs"]');
  await expect(page.locator('[data-option="Waist"]')).toBeVisible();
  // Hidden: gone for customers.
  await switchTo(page, "admin");
  await page.goto("/app/salon/styles");
  await page.click('[data-manage-style="Goddess locs"]');
  await page.locator("[data-style-active]").uncheck();
  await page.click("[data-save-style]");
  await expect(page.locator('[data-manage-style="Goddess locs"]')).toContainText("Hidden");
  await switchTo(page, "customer");
  await page.goto("/app/book");
  await expect(page.locator('[data-pick-style="Goddess locs"]')).toHaveCount(0);
});

test("change a stylist's week and add time off; booking follows", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/app/salon/team");
  await page.click('[data-manage-stylist="Hiwot"]');
  // Hiwot stops working Mondays.
  await page.locator("[data-works='1']").uncheck();
  await noSideScroll(page);
  await page.click("[data-save-stylist]");
  await expect(page.locator('[data-manage-stylist="Hiwot"]')).not.toContainText("Mon");
  // Time off for Selam.
  await page.click("[data-add-time-off]");
  await page.fill("#to-why", "Dentist");
  await page.click("[data-save-time-off]");
  await expect(page.locator("[data-time-off-list]")).toContainText("Dentist");
  // A customer choosing Hiwot finds every Monday full.
  await switchTo(page, "customer");
  await page.goto("/app/book");
  await page.click('[data-pick-style="Cornrows"]');
  await page.click("[data-next]");
  await page.click('[data-stylist="Hiwot"]');
  const mondays = await page.locator("[data-days] button").evaluateAll((els) =>
    els.filter((e) => new Date(`${e.getAttribute("data-day")}T12:00:00Z`).getUTCDay() === 1).map((e) => (e as HTMLButtonElement).disabled));
  expect(mondays.length).toBeGreaterThan(0);
  expect(mondays.every(Boolean)).toBe(true);
});

test("home visits: the salon changes the area and travel time; customers follow it", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/app/salon");
  await page.click('[data-salon-link="/app/salon/visits"]');
  await expect(page.locator("#zips")).toHaveValue("200, 201, 202, 203, 204, 205, 206, 207, 208, 209");
  await expect(page.locator("#travel")).toHaveValue("60");
  await page.fill("#zips", "200, 2x");
  await page.click("[data-save-visits]");
  await expect(page.getByText("Use the first three digits")).toBeVisible();
  await page.fill("#zips", "200");
  await expect(page.locator("[data-area-preview]")).toContainText("ZIP codes starting 200");
  await page.fill("#travel", "30");
  await page.click("[data-save-visits]");
  await expect(page.getByText("Saved")).toBeVisible();
  // Hana in Washington (20001) can still book; Silver Spring (20910) is now outside.
  await switchTo(page, "customer");
  await page.goto("/app/book");
  await page.click('[data-pick-style="Takedown and wash"]');
  await page.locator("[data-days] button:not([disabled])").nth(1).click();
  await page.locator("[data-slots] button").first().click();
  await page.click("[data-next]");
  await page.fill("#zip", "20910");
  await page.click("[data-next]");
  await expect(page.locator("[data-place-problem=area]")).toContainText("only ZIP codes starting 200.");
});

test("reports: the week's bars, popular styles and rates", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/app/salon/reports");
  await expect(page.locator("[data-week-bars] > div")).toHaveCount(8);
  await expect(page.locator("[data-popular] li").first()).toBeVisible();
  await expect(page.locator("[data-report-stats]")).toContainText("No-show rate");
  await expect(page.locator("[data-report-stats]")).toContainText("%");
  await noSideScroll(page);
});

test("customers can't open the salon's pages", async ({ page }) => {
  await signIn(page, "customer");
  for (const path of ["/app/salon", "/app/salon/styles", "/app/salon/team", "/app/salon/reports", "/app/calendar"]) {
    await page.goto(path);
    await expect(page.getByText("This page is for the salon.")).toBeVisible();
  }
});
