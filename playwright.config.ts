import { defineConfig } from "@playwright/test";

// Run with: npm run test:e2e   (needs a local PostgreSQL; uses a separate *_test database)
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    // locally use the installed Edge; CI installs Chromium (npx playwright install chromium)
    channel: process.env.CI ? undefined : "msedge",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://localhost:3100/login",
    timeout: 360_000,
    reuseExistingServer: !process.env.CI,
  },
});
