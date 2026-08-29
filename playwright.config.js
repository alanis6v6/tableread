// @ts-check
import { defineConfig } from "@playwright/test";

// The sandbox pre-installs Chromium at a fixed path instead of the revision
// Playwright's own package expects; pointing executablePath there avoids an
// attempted (and blocked) browser download. See scripts/dev-server.mjs for
// why a plain static server (not a bundler) is enough here.
const CHROMIUM_PATH = "/opt/pw-browsers/chromium";

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
