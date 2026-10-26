import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/iphone.spec.ts",
      use: { browserName: "chromium", channel: "chrome" },
    },
    {
      name: "iphone-webkit",
      testMatch: "**/iphone.spec.ts",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
});
