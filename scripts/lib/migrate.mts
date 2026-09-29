import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

export const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../db/migrations");

/** .env.local이 있으면 읽는다. 이미 설정된 환경 변수는 덮어쓰지 않는다. */
export function loadLocalEnv() {
  const file = path.resolve(import.meta.dirname, "../../.env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경 변수가 없습니다. .env.local을 확인하세요.`);
  return value;
}

/** 접속 문자열에서 비밀번호를 가린다(로그용). */
export function redact(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "(잘못된 접속 문자열)";
  }
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

async function ensureTable(client: pg.Client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
}

async function appliedVersions(client: pg.Client): Promise<Set<string>> {
  const { rows } = await client.query<{ version: string }>("SELECT version FROM schema_migrations");
  return new Set(rows.map((row) => row.version));
}

/** 적용하지 않은 마이그레이션을 파일마다 트랜잭션으로 적용하고, 적용한 파일 이름을 돌려준다. */
export async function migrateUp(connectionString: string): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await ensureTable(client);
    const applied = await appliedVersions(client);
    const done: string[] = [];
    for (const file of migrationFiles()) {
      if (applied.has(file)) continue;
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${file} 적용 실패: ${(error as Error).message}`);
      }
      done.push(file);
    }
    return done;
  } finally {
    await client.end();
  }
}

export async function migrationStatus(
  connectionString: string,
): Promise<{ file: string; applied: boolean }[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await ensureTable(client);
    const applied = await appliedVersions(client);
    return migrationFiles().map((file) => ({ file, applied: applied.has(file) }));
  } finally {
    await client.end();
  }
}
