// 사용법: node scripts/db-migrate.mts [up|status]
// postgres MCP는 읽기 전용이라 DDL은 이 스크립트로 적용하고, 결과는 MCP로 검증한다 (plan §1).
import { loadLocalEnv, migrateUp, migrationStatus, redact, requireEnv } from "./lib/migrate.mts";

loadLocalEnv();
const url = requireEnv("DATABASE_URL");
const command = process.argv[2] ?? "up";

if (command === "up") {
  const applied = await migrateUp(url);
  console.log(`[db:migrate] ${redact(url)}`);
  console.log(
    applied.length ? applied.map((file) => `  적용: ${file}`).join("\n") : "  적용할 마이그레이션 없음",
  );
} else if (command === "status") {
  console.log(`[db:status] ${redact(url)}`);
  for (const { file, applied } of await migrationStatus(url)) {
    console.log(`  ${applied ? "✓" : "·"} ${file}`);
  }
} else {
  console.error(`알 수 없는 명령: ${command} (up | status)`);
  process.exit(1);
}
