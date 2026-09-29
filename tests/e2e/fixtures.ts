import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

export interface Account {
  email: string;
  password: string;
}

export const newAccount = (): Account => ({
  email: `e2e+${randomUUID()}@test.local`,
  password: "e2e-password-1",
});

/** 회원가입 화면으로 가입한다. 가입하면 바로 로그인되어 보드로 이동한다 (FR-4). */
export async function signUp(page: Page, account: Account) {
  await page.goto("/signup");
  await page.getByLabel("이메일").fill(account.email);
  await page.getByLabel("패스워드", { exact: true }).fill(account.password);
  await page.getByLabel("패스워드 확인").fill(account.password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(account.email);
}

export async function logIn(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(account.email);
  await page.getByLabel("패스워드", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByTestId("current-user")).toHaveText(account.email);
}

interface Fixtures {
  /** false면 로그인하지 않은 page를 준다(로그인·가입 화면 테스트용). */
  loggedIn: boolean;
  /** 이 테스트에서 가입한 계정. 테스트마다 새 유저라 보드가 서로 섞이지 않는다. */
  account: Account;
}

export const test = base.extend<Fixtures>({
  loggedIn: [true, { option: true }],
  account: async ({}, provide) => {
    await provide(newAccount());
  },
  page: async ({ page, loggedIn, account }, provide) => {
    if (loggedIn) await signUp(page, account);
    await provide(page);
  },
});
