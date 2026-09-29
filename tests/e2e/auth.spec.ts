import { randomUUID } from "node:crypto";
import { expect, logIn, newAccount, signUp, test } from "./fixtures";
import { column } from "./helpers";

const LOGIN_FAILED = "이메일 또는 패스워드가 올바르지 않습니다.";

/** 폼의 오류 알림. Next.js 라우트 안내(__next-route-announcer__)도 role=alert라 폼 안으로 좁힌다. */
const formAlert = (page: import("@playwright/test").Page) => page.locator("form").getByRole("alert");

test.describe("인증 (T-029)", () => {
  test.use({ loggedIn: false });

  test("로그인하지 않고 보드에 들어가면 로그인 화면으로 간다 (US6)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  });

  test("가입하면 빈 보드와 내 이메일이 보인다 (SC-1)", async ({ page }) => {
    const account = newAccount();
    await signUp(page, account);
    await expect(page).toHaveURL(/\/$/);
    for (const status of ["TODO", "IN_PROGRESS", "DONE"] as const) {
      await expect(page.getByTestId(`column-count-${status}`)).toHaveText(/카드 0개/);
    }
    await expect(column(page, "TODO")).toBeVisible();
  });

  test("대소문자와 공백만 다른 이메일로 다시 가입할 수 없다 (SC-2)", async ({ page, browser }) => {
    const account = newAccount();
    await signUp(page, account);

    const guest = await (await browser.newContext()).newPage();
    await guest.goto("/signup");
    await guest.getByLabel("이메일").fill(`  ${account.email.toUpperCase()} `);
    await guest.getByLabel("패스워드", { exact: true }).fill("another-pass");
    await guest.getByLabel("패스워드 확인").fill("another-pass");
    await guest.getByRole("button", { name: "가입하기" }).click();
    await expect(guest.getByText("이미 가입된 이메일입니다.")).toBeVisible();
    await expect(guest).toHaveURL(/\/signup$/);
  });

  test("틀린 패스워드와 없는 이메일에 같은 오류를 보여준다 (SC-3)", async ({ page, browser }) => {
    const account = newAccount();
    await signUp(page, account);

    const guest = await (await browser.newContext()).newPage();
    const tryLogin = async (email: string, password: string) => {
      await guest.goto("/login");
      await guest.getByLabel("이메일").fill(email);
      await guest.getByLabel("패스워드", { exact: true }).fill(password);
      await guest.getByRole("button", { name: "로그인" }).click();
      const alert = formAlert(guest).filter({ hasText: /\S/ });
      await expect(alert).toBeVisible();
      return alert.textContent();
    };
    const wrongPassword = await tryLogin(account.email, "wrong-password");
    const unknownEmail = await tryLogin(`ghost-${randomUUID()}@test.local`, "wrong-password");
    expect(wrongPassword).toBe(LOGIN_FAILED);
    expect(unknownEmail).toBe(LOGIN_FAILED);
  });

  test("로그아웃하면 로그인 화면으로 가고, 보드와 API에 접근할 수 없다 (SC-4)", async ({ page }) => {
    const account = newAccount();
    await signUp(page, account);
    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/board")).status()).toBe(401);

    await logIn(page, account);
    await expect(page).toHaveURL(/\/$/);
  });

  test("로그인에 10번 실패하면 11번째는 올바른 패스워드라도 막는다 (SC-9)", async ({ browser }) => {
    // IP 기준 제한이 다른 테스트에 번지지 않도록 이 테스트만의 IP로 보낸다.
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    });
    const page = await context.newPage();
    const account = newAccount();
    await signUp(page, account);
    await page.getByRole("button", { name: "로그아웃" }).click();

    for (let i = 0; i < 10; i++) {
      await page.getByLabel("이메일").fill(account.email);
      await page.getByLabel("패스워드", { exact: true }).fill(`wrong-${i}`);
      await page.getByRole("button", { name: "로그인" }).click();
      await expect(formAlert(page)).toHaveText(LOGIN_FAILED);
      await expect(page.getByRole("button", { name: "로그인" })).toBeEnabled();
    }
    await page.getByLabel("이메일").fill(account.email);
    await page.getByLabel("패스워드", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(formAlert(page)).toHaveText(/로그인 시도가 너무 많습니다/);
    await context.close();
  });

  test("위조한 세션 쿠키로 들어가도 반복 리다이렉트 없이 로그인 화면이 보인다", async ({
    page,
    baseURL,
  }) => {
    await page.context().addCookies([{ name: "kanban_session", value: "forged", url: baseURL! }]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === "kanban_session")).toBeUndefined();
  });
});
