// 테스트 DB를 만들고(없으면) 마이그레이션을 적용한 뒤 모든 데이터를 비운다.
// 사용법: node scripts/db-test-setup.mts
import pg from "pg";
import { loadLocalEnv, migrateUp, redact, requireEnv } from "./lib/migrate.mts";

export async function setupTestDatabase(): Promise<string> {
  loadLocalEnv();
  const url = requireEnv("TEST_DATABASE_URL");
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));

  // 개발 DB를 실수로 비우지 않도록 막는다.
  const devUrl = process.env.DATABASE_URL;
  if (devUrl && new URL(devUrl).pathname === target.pathname && new URL(devUrl).host === target.host) {
    throw new Error("TEST_DATABASE_URL이 DATABASE_URL과 같은 DB를 가리킵니다. 테스트 DB를 따로 지정하세요.");
  }
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error(`테스트 DB 이름이 올바르지 않습니다: ${dbName}`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    // CREATE DATABASE는 파라미터 바인딩을 쓸 수 없다. 이름은 위에서 [a-z0-9_]로 검증했다.
    // eslint-disable-next-line no-restricted-syntax
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  await migrateUp(url);

  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    await db.query("TRUNCATE users, login_attempts RESTART IDENTITY CASCADE");
  } finally {
    await db.end();
  }
  return url;
}

if (import.meta.main ?? process.argv[1]?.endsWith("db-test-setup.mts")) {
  const url = await setupTestDatabase();
  console.log(`[db:test:setup] 준비 완료: ${redact(url)}`);
}
