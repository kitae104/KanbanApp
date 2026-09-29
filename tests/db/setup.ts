import { afterAll, beforeEach, inject } from "vitest";
import { createPool, getPool, setPool } from "@/server/db/pool";

// 앱 코드가 쓰는 풀을 테스트 DB로 바꾼다.
setPool(createPool(inject("testDatabaseUrl")));

beforeEach(async () => {
  await getPool().query("TRUNCATE users, login_attempts RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await getPool().end();
  setPool(undefined);
});
