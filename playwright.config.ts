import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    // 지원 브라우저는 Chromium 계열(Chrome, Edge)이다 (NFR-7). Edge는 PC에 설치된 브라우저를 쓴다.
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
      testIgnore: /(mobile|performance)\.spec/,
    },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(mobile|smoke)\.spec/ },
  ],
  webServer: {
    command: "npm run build && npm run start",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
