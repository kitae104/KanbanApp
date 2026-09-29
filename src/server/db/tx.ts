import "server-only";

import type { PoolClient } from "pg";
import { getPool } from "./pool";

/** fn을 한 트랜잭션으로 실행한다. 예외가 나면 롤백하고 다시 던진다. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
