import { defineConfig } from "@playwright/test";

// The two real websites (customer and staff), built side by side with placeholder
// Supabase values: enough to check who sees which sign-in and sign-up pages.
// (The demo website is tested by playwright.config.ts.)
const env = (site: string, dir: string) =>
  `NEXT_DIST_DIR=${dir} NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key NEXT_PUBLIC_SITE=${site} NEXT_PUBLIC_STAFF_URL=http://localhost:3202`;
const server = (site: string, port: number) => {
  const e = env(site, `.next-${site}`);
  return { command: `${e} npm run build && ${e} npx next start -p ${port}`, url: `http://localhost:${port}/login`, reuseExistingServer: true, timeout: 240_000 };
};

export default defineConfig({
  testDir: "tests/sites",
  reporter: "list",
  use: { launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  webServer: [server("customer", 3201), server("staff", 3202)],
  projects: [390, 1280].flatMap((width) => [
    { name: `customer-w${width}`, testMatch: /customer\.spec\.ts/, use: { baseURL: "http://localhost:3201", viewport: { width, height: 800 } } },
    { name: `staff-w${width}`, testMatch: /staff\.spec\.ts/, use: { baseURL: "http://localhost:3202", viewport: { width, height: 800 } } },
  ]),
});
