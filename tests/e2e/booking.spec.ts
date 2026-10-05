import { expect, test, type Page } from "@playwright/test";

const asCustomer = async (page: Page) => {
  await page.goto("/login");
  await page.click("[data-demo=customer]");
  await expect(page.getByRole("heading", { name: "Hello, Hana" })).toBeVisible();
};
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
// The first day (after today) that has free times, and its first time.
const firstFreeTime = async (page: Page) => {
  await page.locator("[data-days] button:not([disabled])").nth(1).click();
  const first = page.locator("[data-slots] button").first();
  await expect(first).toBeVisible();
  return first;
};

test("book knotless braids in five steps; the stylist comes to the saved address; the salon sees it", async ({ page }) => {
  await asCustomer(page);
  await page.locator("[data-book-cta]").click();
  await expect(page.getByRole("heading", { name: "Choose a style" })).toBeVisible();
  // 1. Style
  await page.click('[data-pick-style="Knotless braids"]');
  await expect(page.getByRole("heading", { name: "Size and length" })).toBeVisible();
  // 2. Size and length: the total follows; Continue waits for both.
  const summary = page.locator("[data-summary]");
  await expect(page.locator("[data-next]")).toBeDisabled();
  await expect(summary).toContainText("Choose a size.");
  await page.click('[data-option="Small"]');
  await expect(summary).toContainText("Choose a length.");
  await page.click('[data-option="Waist"]');
  await expect(summary).toContainText("$390"); // 250 + 60 + 80
  await expect(summary).toContainText("6 h 30 min");
  await noSideScroll(page);
  await page.click("[data-next]");
  // 3. Date and time: any stylist, the first free time on the next free day.
  await expect(page.getByRole("heading", { name: "Date and time" })).toBeVisible();
  const slot = await firstFreeTime(page);
  const time = await slot.innerText();
  await slot.click();
  await noSideScroll(page);
  await page.click("[data-next]");
  // 4. Where: Hana's saved address is filled in; only ZIP codes 200-209.
  await expect(page.getByRole("heading", { name: "Where should we come?" })).toBeVisible();
  await expect(page.locator("#address")).toHaveValue("12 Demo Street NW, Apt 4");
  await expect(page.locator("[data-place]")).toContainText("ZIP codes starting 200–209");
  await page.fill("#zip", "22201");
  await page.click("[data-next]");
  await expect(page.locator("[data-place-problem=area]")).toContainText("we don't travel there yet");
  await page.fill("#zip", "20001");
  await noSideScroll(page);
  await page.click("[data-next]");
  // 5. Review and send.
  const review = page.locator("[data-review]");
  await expect(review).toContainText("Knotless braids");
  await expect(review).toContainText("Small · Waist");
  await expect(review).toContainText(time);
  await expect(review).toContainText("$390, paid to your stylist on the day");
  await expect(review).toContainText("12 Demo Street NW, Apt 4");
  await expect(review).toContainText("Washington, DC 20001");
  await page.fill("#note", "Black hair, please");
  await page.click("[data-confirm]");
  await expect(page.locator("[data-booking-sent]")).toContainText("Request sent");
  // Home: it's among the upcoming ones, waiting for confirmation.
  await page.getByRole("link", { name: "See my appointments" }).click();
  const mine = page.locator("[role=tabpanel] [data-appointment]", { hasText: "Small · Waist" });
  await expect(mine).toContainText("Waiting for confirmation");
  // The salon sees the new request.
  await page.goto("/app/account");
  await page.click("[data-sign-out]");
  await page.click("[data-demo=admin]");
  await expect(page.locator("[data-requests]")).toContainText("Hana Bekele");
  await page.locator("[data-requests] [data-appointment]", { hasText: "Small · Waist" }).click();
  // The salon sees where to go, with a map link.
  await expect(page.locator("[data-sheet-place]")).toContainText("12 Demo Street NW, Apt 4");
  await expect(page.locator("[data-sheet] [data-map]")).toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=12%20Demo%20Street/);
});

test("a new address and ZIP code are checked and saved for next time", async ({ page }) => {
  await asCustomer(page);
  await page.goto("/app/book");
  await page.click('[data-pick-style="Takedown and wash"]');
  await (await firstFreeTime(page)).click();
  await page.click("[data-next]");
  await page.fill("#address", "");
  await page.click("[data-next]");
  await expect(page.locator("[data-place-problem=address]")).toBeVisible();
  await page.fill("#address", "77 Demo Way");
  await page.fill("#city", "Bethesda, MD");
  await page.fill("#zip", "208");
  await page.click("[data-next]");
  await expect(page.locator("[data-place-problem=zip]")).toBeVisible();
  await page.fill("#zip", "20814");
  await page.click("[data-next]");
  await page.click("[data-confirm]");
  await expect(page.locator("[data-booking-sent]")).toBeVisible();
  await page.goto("/app/account");
  await expect(page.locator("[data-home]")).toContainText("77 Demo Way");
  await expect(page.locator("[data-home]")).toContainText("Bethesda, MD 20814");
});

test("a style from the styles list starts the booking with it; one-step styles skip to the time", async ({ page }) => {
  await asCustomer(page);
  await page.goto("/app/styles");
  await page.locator('[data-style="Takedown and wash"] [data-book-style]').click();
  // No sizes or lengths: straight to the date and time.
  await expect(page.getByRole("heading", { name: "Date and time" })).toBeVisible();
  await expect(page.locator("[data-summary]")).toContainText("$40");
  // Back goes to the style list.
  await page.click("[data-back]");
  await expect(page.getByRole("heading", { name: "Choose a style" })).toBeVisible();
});

test("choosing a stylist offers only their free times; their day off is full", async ({ page }) => {
  await asCustomer(page);
  await page.goto("/app/book");
  await page.click('[data-pick-style="Cornrows"]');
  await page.click("[data-next]");
  await page.click('[data-stylist="Meron"]');
  // Meron doesn't work on Sundays or Tuesdays.
  const days = page.locator("[data-days] button");
  await expect(days.first()).toBeVisible();
  const offDays = await days.evaluateAll((els) => els.filter((e) => {
    const d = new Date(`${e.getAttribute("data-day")}T12:00:00Z`).getUTCDay();
    return d === 0 || d === 2;
  }).map((e) => (e as HTMLButtonElement).disabled));
  expect(offDays.length).toBeGreaterThan(0);
  expect(offDays.every(Boolean)).toBe(true);
});

test("cancel a waiting request from My appointments", async ({ page }) => {
  await asCustomer(page);
  const passion = page.locator("[role=tabpanel] [data-appointment]", { hasText: "Passion twists" });
  await expect(passion).toContainText("Waiting for confirmation");
  await passion.locator("[data-cancel]").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Cancel this appointment?");
  // "Keep it" changes nothing.
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toHaveCount(0);
  await passion.locator("[data-cancel]").click();
  await page.click("[data-confirm-cancel]");
  await expect(page.getByText("Appointment cancelled")).toBeVisible();
  await expect(page.locator("[role=tabpanel] [data-appointment]", { hasText: "Passion twists" })).toHaveCount(0);
  await page.click("[data-tab=past]");
  await expect(page.locator("[role=tabpanel] [data-appointment]", { hasText: "Passion twists" })).toContainText("Cancelled");
});

test("at most 3 upcoming bookings", async ({ page }) => {
  await asCustomer(page); // Hana has 2 upcoming
  await page.goto("/app/book");
  await page.click('[data-pick-style="Takedown and wash"]');
  await (await firstFreeTime(page)).click();
  await page.click("[data-next]");
  await page.click("[data-next]"); // the saved address
  await page.click("[data-confirm]");
  await expect(page.locator("[data-booking-sent]")).toBeVisible();
  await page.goto("/app/book");
  await expect(page.getByText("You already have 3 upcoming appointments.")).toBeVisible();
});

test("the salon admin has no Book tab", async ({ page }) => {
  await page.goto("/login");
  await page.click("[data-demo=admin]");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book", exact: true })).toHaveCount(0);
});
