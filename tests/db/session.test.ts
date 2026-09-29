import { describe, expect, it } from "vitest";
import { deleteSession, getSessionUser, hashToken, insertSession } from "@/server/auth/session";
import { query } from "@/server/db/pool";
import { createUser } from "./helpers";

describe("session", () => {
  it("DB에는 토큰 원문이 아니라 64자 sha256 hex만 저장한다", async () => {
    const user = await createUser();
    const { token } = await insertSession(user.userId);
    const { rows } = await query<{ id: string }>("SELECT id FROM sessions");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].id).toBe(hashToken(token));
    expect(rows[0].id).not.toContain(token);
  });

  it("토큰으로 유저, 이메일, 보드를 찾는다", async () => {
    const user = await createUser("a@test.local");
    const { token } = await insertSession(user.userId);
    expect(await getSessionUser(token)).toEqual({
      userId: user.userId,
      email: "a@test.local",
      boardId: user.boardId,
    });
  });

  it("없는 토큰, 빈 토큰, 만료된 세션은 null이다", async () => {
    const user = await createUser();
    const { token } = await insertSession(user.userId);
    expect(await getSessionUser(undefined)).toBeNull();
    expect(await getSessionUser("forged-token")).toBeNull();

    await query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    expect(await getSessionUser(token)).toBeNull();
  });

  it("삭제한 세션은 더 이상 찾을 수 없다", async () => {
    const user = await createUser();
    const { token } = await insertSession(user.userId);
    await deleteSession(token);
    expect(await getSessionUser(token)).toBeNull();
  });

  it("로그인할 때마다 새 토큰을 발급하고, 만료된 세션은 정리한다", async () => {
    const user = await createUser();
    const first = await insertSession(user.userId);
    await query("UPDATE sessions SET expires_at = now() - interval '1 second'");
    const second = await insertSession(user.userId);

    expect(second.token).not.toBe(first.token);
    const { rows } = await query<{ id: string }>("SELECT id FROM sessions");
    expect(rows.map((row) => row.id)).toEqual([hashToken(second.token)]);
  });

  it("만료는 7일 뒤다", async () => {
    const user = await createUser();
    const { expiresAt } = await insertSession(user.userId);
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });
});
