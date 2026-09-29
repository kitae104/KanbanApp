// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyDummy, verifyPassword } from "@/server/auth/password";

describe("password", () => {
  it("argon2id 해시를 만들고, 같은 입력이라도 salt 때문에 해시가 다르다", async () => {
    const [a, b] = await Promise.all([hashPassword("password1"), hashPassword("password1")]);
    expect(a).toMatch(/^\$argon2id\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("password1");
  });

  it("올바른 패스워드만 통과한다", async () => {
    const stored = await hashPassword("password1");
    expect(await verifyPassword(stored, "password1")).toBe(true);
    expect(await verifyPassword(stored, "password2")).toBe(false);
  });

  it("해시 형식이 깨졌으면 예외 대신 false를 돌려준다", async () => {
    expect(await verifyPassword("not-a-hash", "password1")).toBe(false);
  });

  it("verifyDummy는 항상 false이고 실제 검증과 비슷한 시간이 걸린다", async () => {
    const stored = await hashPassword("password1");
    await verifyDummy("warm-up");

    const time = async (fn: () => Promise<unknown>) => {
      const start = performance.now();
      for (let i = 0; i < 5; i++) await fn();
      return performance.now() - start;
    };
    const real = await time(() => verifyPassword(stored, "wrong"));
    const dummy = await time(() => verifyDummy("wrong"));

    expect(await verifyDummy("password1")).toBe(false);
    expect(Math.abs(real - dummy) / real).toBeLessThan(0.3);
  });
});
