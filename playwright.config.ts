import { defineConfig, devices } from "@playwright/test";

/** Match `npm run dev` (--port 3100). Override with PLAYWRIGHT_BASE_URL if needed. */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "shell",
      testMatch: /shell-bypass\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "planning",
      testMatch: /planning-flow\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // One server for both projects: bypass enables shell without a session;
  // planning-flow still signs in with operator credentials.
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          KEPLO_DEV_BYPASS_AUTH: "true",
        },
      },
});
