import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E는 개발 DB(mydb)가 아닌 테스트 DB(TEST_DATABASE_URL)로 돈다 (plan §9.3).
// 개발 서버(3000)와 섞이지 않도록 포트를 따로 쓰고, 이미 떠 있는 서버를 재사용하지 않는다.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL이 없습니다. .env.local을 확인하세요.");

const PORT = 3100;

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
    command: `npm run build && npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      // 로컬 http에서 돌리므로 Secure 쿠키를 끈다.
      SESSION_COOKIE_SECURE: "false",
    },
  },
});
