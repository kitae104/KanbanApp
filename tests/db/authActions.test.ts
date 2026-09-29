import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { SESSION_COOKIE } from "@/server/auth/session";
import { query } from "@/server/db/pool";

// Server Action 밖에서는 cookies()/headers()/redirect()를 쓸 수 없으므로 흉내 낸다.
const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
let requestHeaders = new Headers();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) =>
      jar.set(name, { value, options }),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => requestHeaders,
}));

class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

const { login, logout, signup } = await import("@/app/(auth)/actions");

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

const signupForm = (email: string, password = "password1") =>
  form({ email, password, passwordConfirm: password });

async function expectRedirect(promise: Promise<unknown>, url: string) {
  await expect(promise).rejects.toMatchObject({ url });
}

beforeEach(() => {
  jar.clear();
  requestHeaders = new Headers({ "x-forwarded-for": "10.0.0.1" });
});

describe("signup", () => {
  it("유저와 보드를 함께 만들고, 세션 쿠키를 설정한 뒤 /로 보낸다", async () => {
    await expectRedirect(signup({}, signupForm(" New@Test.local ")), "/");

    const { rows } = await query<{ email: string; boards: string; password_hash: string }>(
      `SELECT u.email, u.password_hash, count(b.id) AS boards
         FROM users u LEFT JOIN boards b ON b.user_id = u.id GROUP BY u.id`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("new@test.local");
    expect(Number(rows[0].boards)).toBe(1);
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);

    const cookie = jar.get(SESSION_COOKIE);
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("대소문자와 공백만 다른 이메일로는 다시 가입할 수 없다", async () => {
    await expectRedirect(signup({}, signupForm("dup@test.local")), "/");
    const state = await signup({}, signupForm("  DUP@test.local"));
    expect(state.fieldErrors?.email).toBe(AUTH_MESSAGES.emailTaken);
    expect(Number((await query<{ n: string }>("SELECT count(*) AS n FROM users")).rows[0].n)).toBe(1);
  });

  it("검증에 실패하면 필드 오류를 돌려주고 패스워드는 돌려주지 않는다", async () => {
    const state = await signup(
      {},
      form({ email: "bad", password: "short", passwordConfirm: "other" }),
    );
    expect(Object.keys(state.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["email", "password"]),
    );
    expect(JSON.stringify(state)).not.toContain("short");
  });
});

describe("login", () => {
  beforeEach(async () => {
    await expectRedirect(signup({}, signupForm("user@test.local", "correct-pass")), "/");
    jar.clear();
  });

  it("올바른 이메일과 패스워드면 새 세션으로 /에 보낸다", async () => {
    await expectRedirect(
      login({}, form({ email: "USER@test.local", password: "correct-pass" })),
      "/",
    );
    expect(jar.get(SESSION_COOKIE)?.value).toBeTruthy();
  });

  it("틀린 패스워드와 없는 이메일에 같은 메시지를 준다", async () => {
    const wrongPassword = await login({}, form({ email: "user@test.local", password: "nope" }));
    const unknownEmail = await login({}, form({ email: "ghost@test.local", password: "nope" }));
    expect(wrongPassword.formError).toBe(AUTH_MESSAGES.loginFailed);
    expect(unknownEmail.formError).toBe(wrongPassword.formError);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it("10번 실패하면 11번째에는 올바른 패스워드도 막는다", async () => {
    for (let i = 0; i < 10; i++) {
      await login({}, form({ email: "user@test.local", password: `wrong-${i}` }));
    }
    const state = await login({}, form({ email: "user@test.local", password: "correct-pass" }));
    expect(state.formError).toBe(AUTH_MESSAGES.tooManyAttempts);
  });
});

describe("logout", () => {
  it("세션 행과 쿠키를 지우고 /login으로 보낸다", async () => {
    await expectRedirect(signup({}, signupForm("out@test.local")), "/");
    await expectRedirect(logout(), "/login");
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(Number((await query<{ n: string }>("SELECT count(*) AS n FROM sessions")).rows[0].n)).toBe(0);
  });
});
