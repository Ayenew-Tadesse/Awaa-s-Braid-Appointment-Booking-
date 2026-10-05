// The portfolio photographer: opens the demo salon on a phone (390 × 844) and
// takes the case-study screenshots. Run by .github/workflows/screenshots.yml
// after every change to main; the pictures are published on the "screenshots"
// branch at fixed addresses (phone/<name>.jpg), so a portfolio that links to
// them always shows the current app.
//
//   node scripts/screenshots.mjs <out-dir>     (the app must be running at BASE_URL)
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = process.argv[2] || "screenshots";
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const DIR = `${OUT}/phone`;
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
const page = await ctx.newPage();
const shots = [];
const shot = async (name, label) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/${name}.jpg`, type: "jpeg", quality: 76 });
  shots.push({ file: `phone/${name}.jpg`, label });
};
const as = async (role, ready) => {
  await page.goto(`${BASE}/login`);
  await page.click(`[data-demo=${role}]`);
  await page.waitForSelector(ready);
};

// Visitors: the front page and the styles with prices.
await page.goto(`${BASE}/`);
await page.waitForSelector("[data-style]");
await shot("landing", "Front page");
await page.locator("#styles").evaluate((el) => el.scrollIntoView({ block: "start" }));
await shot("styles", "Styles and prices");

// A customer: her next appointment, then her past ones.
await as("customer", "[data-next]");
await shot("customer-home", "Your next appointment");
await page.click("[data-tab=past]");
await page.locator("[data-tab=past]").evaluate((el) => el.scrollIntoView({ block: "start" }));
await shot("customer-past", "Past appointments");

// Booking: style, size and length, a free time, then review.
await page.goto(`${BASE}/app/book`);
await page.waitForSelector("[data-pick-style]");
await shot("book-1-style", "Choose a style");
await page.click('[data-pick-style="Knotless braids"]');
await page.click('[data-option="Medium"]');
await page.click('[data-option="Mid-back"]');
await shot("book-2-options", "Size and length");
await page.click("[data-next]");
await page.waitForSelector("[data-days] button");
await page.locator("[data-days] button:not([disabled])").nth(1).click();
await page.locator("[data-slots] button").nth(2).click();
await shot("book-3-time", "Date and time");
await page.click("[data-next]");
await page.fill("#note", "Black hair, please");
await shot("book-4-review", "Review and send");
await page.click("[data-confirm]");
await page.waitForSelector("[data-booking-sent]");
await shot("book-5-sent", "Request sent");

// The salon: today at a glance, then the requests waiting (the new one among them).
await page.goto(`${BASE}/app/account`);
await page.click("[data-sign-out]");
await page.waitForURL(/\/login$/);
await as("admin", "[data-admin-stats]");
await shot("admin-today", "The salon's day");
// Just below the sticky top bar, so the "New requests" heading shows.
await page.locator("[data-requests]").evaluate((el) => window.scrollTo(0, el.closest("section").getBoundingClientRect().top + window.scrollY - 64));
await shot("admin-requests", "Requests to confirm");

// The salon's tools: one appointment's actions, the calendar, styles, the team's week and reports.
await page.locator("[data-requests] [data-appointment]").first().click();
await page.waitForSelector("[data-sheet] [data-actions]");
await shot("salon-sheet", "Confirm, decline or move");
await page.keyboard.press("Escape");
await page.goto(`${BASE}/app/calendar`);
await page.waitForSelector("[data-cal-stylist]");
await shot("salon-calendar", "The day, per stylist");
await page.goto(`${BASE}/app/salon/styles`);
await page.locator("[data-manage-style]").first().click();
await page.waitForSelector("[data-style-editor]");
await shot("salon-style", "Edit a style and its options");
await page.keyboard.press("Escape");
await page.goto(`${BASE}/app/salon/team`);
await page.locator("[data-manage-stylist]").first().click();
await page.waitForSelector("[data-stylist-editor]");
await shot("salon-hours", "A stylist's working week");
await page.keyboard.press("Escape");
await page.goto(`${BASE}/app/salon/reports`);
await page.waitForSelector("[data-week-bars]");
await shot("salon-reports", "Reports");

await browser.close();
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  app: "Awaa Braids", device: "phone", size: "390x844",
  taken_at: new Date().toISOString(), commit: process.env.GITHUB_SHA || null, shots,
}, null, 2));
console.log(`Saved ${shots.length} screenshots to ${OUT}/`);
