import { defineConfig } from "vitest/config";
// Unit tests live next to the code; browser tests (tests/e2e) run with Playwright.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
