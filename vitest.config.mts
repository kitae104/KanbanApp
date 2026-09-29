import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
// server-only는 React 서버 환경 밖에서 import하면 예외를 던진다. 테스트에서는 빈 모듈로 바꾼다.
const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": src, "server-only": serverOnlyStub },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      thresholds: { lines: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["tests/unit/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        // 실제 PostgreSQL 테스트 DB(TEST_DATABASE_URL)에 붙는 통합 테스트 (plan §9.2).
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["tests/db/globalSetup.ts"],
          setupFiles: ["tests/db/setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
