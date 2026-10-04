import { defineConfig } from "@playwright/test";

// Phone first: small and common phones, then a tablet and a laptop.
const WIDTHS = [360, 390, 768, 1280];

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3200",
    // Use a preinstalled Chromium when given (CI images, sandboxes); otherwise Playwright's own.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: WIDTHS.map((width) => ({ name: `w${width}`, use: { viewport: { width, height: 800 }, hasTouch: width < 768 } })),
  webServer: { command: "npm run build && npx next start -p 3200", url: "http://localhost:3200", reuseExistingServer: true, timeout: 180_000 },
});
