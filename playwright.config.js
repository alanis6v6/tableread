// @ts-check
import { defineConfig } from "@playwright/test";

// Some sandboxes (this repo's own dev environment included) pre-install
// Chromium at a fixed path instead of the revision Playwright's own package
// expects, and block the attempted browser download outright. Point
// executablePath there only when PW_CHROMIUM_PATH is set; everywhere else
// (a contributor's machine, CI, a judge running `npx playwright test`)
// leave it undefined so Playwright manages its own browser normally. See
// scripts/dev-server.mjs for why a plain static server (not a bundler) is
// enough here.
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8787",
    launchOptions: { executablePath: CHROMIUM_PATH },
  },
  webServer: {
    command: "node scripts/dev-server.mjs",
    url: "http://localhost:8787",
    reuseExistingServer: !process.env.CI,
    env: { PORT: "8787" },
  },
});
