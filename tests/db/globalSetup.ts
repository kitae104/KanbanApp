import { setupTestDatabase } from "../../scripts/db-test-setup.mts";

/** 테스트 DB를 만들고 마이그레이션을 적용한다. 접속 문자열은 각 테스트 워커에 넘긴다. */
export default async function globalSetup({ provide }: { provide: (key: string, value: string) => void }) {
  const url = await setupTestDatabase();
  provide("testDatabaseUrl", url);
}

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}
