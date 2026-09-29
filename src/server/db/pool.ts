import "server-only";

import { Pool, type QueryResultRow } from "pg";

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

// 개발 모드 핫 리로드 때마다 모듈이 다시 평가되므로 풀은 globalThis에 한 번만 만든다 (plan §3).
const globalForDb = globalThis as typeof globalThis & { __kanbanPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.__kanbanPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL 환경 변수가 없습니다. .env.local을 확인하세요.");
    globalForDb.__kanbanPool = createPool(url);
  }
  return globalForDb.__kanbanPool;
}

/** 테스트에서 풀을 바꿔 끼운다. */
export function setPool(pool: Pool | undefined) {
  globalForDb.__kanbanPool = pool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
