import { describe, expect, it } from "vitest";
import {
  LOGIN_MAX_FAILURES,
  getClientIp,
  isLoginBlocked,
  recordLoginAttempt,
} from "@/server/auth/rateLimit";

const NOW = new Date("2026-09-29T10:00:00Z");
const minutesAfter = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

async function fail(times: number, email: string, ip: string, at = NOW) {
  for (let i = 0; i < times; i++) await recordLoginAttempt(email, ip, false, at);
}

describe("로그인 시도 제한", () => {
  it("실패 9번까지는 허용하고, 10번 쌓이면 11번째 시도를 막는다", async () => {
    await fail(LOGIN_MAX_FAILURES - 1, "a@test.local", "1.1.1.1");
    expect(await isLoginBlocked("a@test.local", "1.1.1.1", NOW)).toBe(false);
    await fail(1, "a@test.local", "1.1.1.1");
    expect(await isLoginBlocked("a@test.local", "1.1.1.1", NOW)).toBe(true);
  });

  it("15분이 지나면 풀린다", async () => {
    await fail(LOGIN_MAX_FAILURES, "a@test.local", "1.1.1.1");
    expect(await isLoginBlocked("a@test.local", "1.1.1.1", minutesAfter(14))).toBe(true);
    expect(await isLoginBlocked("a@test.local", "1.1.1.1", minutesAfter(16))).toBe(false);
  });

  it("성공한 시도는 세지 않는다", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await recordLoginAttempt("a@test.local", "1.1.1.1", true, NOW);
    }
    expect(await isLoginBlocked("a@test.local", "1.1.1.1", NOW)).toBe(false);
  });

  it("이메일이 달라도 같은 IP에서 10번 실패하면 막는다", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await recordLoginAttempt(`user${i}@test.local`, "2.2.2.2", false, NOW);
    }
    expect(await isLoginBlocked("new@test.local", "2.2.2.2", NOW)).toBe(true);
    expect(await isLoginBlocked("new@test.local", "3.3.3.3", NOW)).toBe(false);
  });

  it("IP가 달라도 같은 이메일로 10번 실패하면 막는다", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await recordLoginAttempt("a@test.local", `10.0.0.${i}`, false, NOW);
    }
    expect(await isLoginBlocked("a@test.local", "9.9.9.9", NOW)).toBe(true);
  });
});

describe("getClientIp", () => {
  it("x-forwarded-for의 첫 값, x-real-ip, 없으면 local 순으로 쓴다", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(getClientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(getClientIp(new Headers())).toBe("local");
  });
});
