import { expect, test, type Page } from "@playwright/test";

const signIn = async (page: Page, who: "admin" | "customer") => {
  await page.goto("/login");
  await page.click(`[data-demo=${who}]`);
  await expect(page.locator(who === "admin" ? "[data-admin-stats]" : "[data-next]")).toBeVisible();
};

test("notifications: the bell counts what's new; opening them marks them read", async ({ page }) => {
  await signIn(page, "customer");
  const count = page.locator("[data-bell-count]");
  await expect(count).toBeVisible();
  const before = Number(await count.innerText());
  expect(before).toBeGreaterThan(0);
  await page.click("[data-bell]");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.locator('[data-note="confirmed"]').first()).toContainText("Your appointment is confirmed");
  // Read now: only reminders for the next 24 hours (if any) still count.
  const reminders = await page.locator("[data-reminder]").count();
  await page.goto("/app");
  if (reminders) await expect(page.locator("[data-bell-count]")).toHaveText(String(reminders));
  else await expect(page.locator("[data-bell-count]")).toHaveCount(0);
});

test("a booking reaches the salon as a notification, and confirming it reaches the customer", async ({ page }) => {
  await signIn(page, "customer");
  await page.goto("/app/book");
  await page.click('[data-pick-style="Takedown and wash"]');
  await page.locator("[data-days] button:not([disabled])").nth(1).click();
  await page.locator("[data-slots] button").first().click();
  await page.click("[data-next]");
  await page.click("[data-next]"); // the saved address
  await page.click("[data-confirm]");
  await expect(page.locator("[data-booking-sent]")).toBeVisible();
  await page.goto("/app/account");
  await page.click("[data-sign-out]");
  await page.click("[data-demo=admin]");
  await page.click("[data-bell]");
  await expect(page.locator('[data-note="booked"]').first()).toContainText("New request from Hana Bekele");
  await expect(page.locator('[data-note="booked"]').first()).toContainText("Takedown and wash");
  // Confirm it from Today; Hana is told.
  await page.goto("/app");
  await page.locator("[data-requests] [data-appointment]", { hasText: "Takedown and wash" }).click();
  await page.click("[data-sheet] [data-action=confirm]");
  await expect(page.locator("[data-sheet]")).toBeVisible();
  await page.goto("/app/account");
  await page.click("[data-sign-out]");
  await page.click("[data-demo=customer]");
  await page.click("[data-bell]");
  await expect(page.locator('[data-note="confirmed"]').first()).toContainText("Takedown and wash");
});

test("Amharic: switch on sign-in; the app, dates and the booking follow; English again from Account", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "አማርኛ" }).click();
  await expect(page.getByRole("heading", { name: "ማሳያውን ይሞክሩ" })).toBeVisible();
  await page.click("[data-demo=customer]");
  await expect(page.getByRole("heading", { name: "ሰላም፣ Hana" })).toBeVisible();
  await expect(page.locator("[data-next]")).toContainText("ተረጋግጧል");
  await expect(page.locator("[data-next]")).toContainText(/ጥዋት|ከሰዓት/); // the time, written in Amharic
  await expect(page.locator("html")).toHaveAttribute("lang", "am");
  await page.goto("/app/book");
  await expect(page.getByRole("heading", { name: "ስታይል ይምረጡ" })).toBeVisible();
  await page.goto("/app/account");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
});

test("offline: a calm banner while there's no connection", async ({ page, context }) => {
  await signIn(page, "customer");
  await context.setOffline(true);
  await expect(page.locator("[data-offline]")).toContainText("You're offline");
  await context.setOffline(false);
  await expect(page.locator("[data-offline]")).toHaveCount(0);
});

test("keyboard: skip to content, and focus stays inside an open sheet", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/app");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.locator("[data-requests] [data-appointment]").first().click();
  const sheet = page.locator("[data-sheet]");
  await expect(sheet).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("[data-sheet]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});
