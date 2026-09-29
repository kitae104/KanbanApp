"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { loginSchema, signupSchema, toFieldErrors, type FieldErrors } from "@/lib/auth/schema";
import { hashPassword, verifyDummy, verifyPassword } from "@/server/auth/password";
import { getClientIp, isLoginBlocked, recordLoginAttempt } from "@/server/auth/rateLimit";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionToken,
} from "@/server/auth/session";
import { createUserWithBoard, findUserByEmail } from "@/server/auth/users";

// Server Action은 공개 엔드포인트와 같다. 입력은 모두 서버에서 다시 검증한다.
// Next.js가 Origin/Host를 비교해 다른 사이트에서의 호출(CSRF)을 막는다 (NFR-4).
// 폼 데이터(패스워드)는 로그에 남기지 않는다 (NFR-5).

export interface AuthFormState {
  fieldErrors?: FieldErrors;
  formError?: string;
  /** 실패했을 때 폼에 다시 채울 이메일. 패스워드는 돌려주지 않는다. */
  email?: string;
}

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    email: field(formData, "email"),
    password: field(formData, "password"),
    passwordConfirm: field(formData, "passwordConfirm"),
  };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), email: raw.email };

  const userId = await createUserWithBoard(
    parsed.data.email,
    await hashPassword(parsed.data.password),
  );
  if (!userId) return { fieldErrors: { email: AUTH_MESSAGES.emailTaken }, email: raw.email };

  await createSession(userId);
  redirect("/");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: field(formData, "email"), password: field(formData, "password") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), email: raw.email };

  const { email, password } = parsed.data;
  const ip = getClientIp(await headers());
  // 막힌 동안에는 해시 검증도, 시도 기록도 하지 않는다 (plan §5.1).
  if (await isLoginBlocked(email, ip)) return { formError: AUTH_MESSAGES.tooManyAttempts, email };

  const user = await findUserByEmail(email);
  // 유저가 없어도 더미 해시로 같은 시간을 쓴다 (NFR-3).
  const valid = user ? await verifyPassword(user.passwordHash, password) : await verifyDummy(password);
  await recordLoginAttempt(email, ip, valid);
  if (!user || !valid) return { formError: AUTH_MESSAGES.loginFailed, email };

  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession(await readSessionToken());
  await clearSessionCookie();
  redirect("/login");
}
