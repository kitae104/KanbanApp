import "server-only";

import { query } from "@/server/db/pool";
import { withTransaction } from "@/server/db/tx";

const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === UNIQUE_VIOLATION;
}

/**
 * 유저와 그 유저의 빈 보드를 한 트랜잭션에서 만든다 (FR-4).
 * 이메일이 이미 있으면 null을 돌려준다.
 */
export async function createUserWithBoard(
  email: string,
  passwordHash: string,
): Promise<string | null> {
  try {
    return await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email, passwordHash],
      );
      await client.query("INSERT INTO boards (user_id) VALUES ($1)", [rows[0].id]);
      return rows[0].id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export async function findUserByEmail(
  email: string,
): Promise<{ id: string; passwordHash: string } | null> {
  const { rows } = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email],
  );
  return rows[0] ? { id: rows[0].id, passwordHash: rows[0].password_hash } : null;
}
