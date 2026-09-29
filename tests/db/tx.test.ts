import { describe, expect, it } from "vitest";
import { query } from "@/server/db/pool";
import { withTransaction } from "@/server/db/tx";

const countUsers = async () =>
  Number((await query<{ n: string }>("SELECT count(*) AS n FROM users")).rows[0].n);

const insertUser = (client: { query: typeof query }, email: string) =>
  client.query("INSERT INTO users (email, password_hash) VALUES ($1, 'x')", [email]);

describe("withTransaction", () => {
  it("정상 종료하면 커밋한다", async () => {
    await withTransaction((client) => insertUser(client, "a@test.local"));
    expect(await countUsers()).toBe(1);
  });

  it("예외가 나면 롤백하고 예외를 다시 던진다", async () => {
    await expect(
      withTransaction(async (client) => {
        await insertUser(client, "a@test.local");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await countUsers()).toBe(0);
  });
});
