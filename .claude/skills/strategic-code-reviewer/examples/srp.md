# SRP (Single Responsibility Principle) 원칙

> 출처: `src/app/(auth)/actions.ts` (login Server Action)

## Bad: 하나의 액션이 폼 처리부터 인증 정책까지 모두 수행
- 문제: FormData 파싱, 입력 검증, 레이트 리밋, 비밀번호 검증(타이밍 균등화), 시도 기록, 세션 생성, 리다이렉트를 한 함수가 처리 (책임 3개 이상)
- 영향: 인증 규칙(예: 잠금 정책) 하나를 테스트하려면 FormData·headers·redirect까지 준비해야 함. 다른 진입점(API 등)에서 재사용 불가

```typescript
export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: field(formData, "email"), password: field(formData, "password") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), email: raw.email };

  const { email, password } = parsed.data;
  const ip = getClientIp(await headers());
  if (await isLoginBlocked(email, ip)) return { formError: AUTH_MESSAGES.tooManyAttempts, email };

  const user = await findUserByEmail(email);
  const valid = user ? await verifyPassword(user.passwordHash, password) : await verifyDummy(password);
  await recordLoginAttempt(email, ip, valid);
  if (!user || !valid) return { formError: AUTH_MESSAGES.loginFailed, email };

  await createSession(user.id);
  redirect("/");
}
```

## Good: 인증 판정과 폼 처리를 분리
- 개선: 인증 판정을 `authenticate`로 추출. 액션은 FormData → 결과 → 응답/리다이렉트 변환만 담당
- 효과: `authenticate`를 FormData 없이 단위 테스트 가능. 순서(잠금 시 해시·기록 생략)는 한 함수에 모여 보존됨

```typescript
// server/auth/authenticate.ts
export type AuthResult =
  | { status: "ok"; userId: string }
  | { status: "blocked" }
  | { status: "failed" };

export async function authenticate(email: string, password: string, ip: string): Promise<AuthResult> {
  if (await isLoginBlocked(email, ip)) return { status: "blocked" };
  const user = await findUserByEmail(email);
  const valid = user ? await verifyPassword(user.passwordHash, password) : await verifyDummy(password);
  await recordLoginAttempt(email, ip, valid);
  return user && valid ? { status: "ok", userId: user.id } : { status: "failed" };
}

// app/(auth)/actions.ts
export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: field(formData, "email"), password: field(formData, "password") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), email: raw.email };

  const { email, password } = parsed.data;
  const result = await authenticate(email, password, getClientIp(await headers()));
  if (result.status === "blocked") return { formError: AUTH_MESSAGES.tooManyAttempts, email };
  if (result.status === "failed") return { formError: AUTH_MESSAGES.loginFailed, email };

  await createSession(result.userId);
  redirect("/");
}
```
