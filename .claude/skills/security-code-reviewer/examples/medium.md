# 🟡 MEDIUM 취약점 예시

## 1. CSRF (Origin 확인 없음)

### 취약
- 문제: 다른 사이트의 폼/스크립트가 로그인된 사용자의 쿠키로 상태 변경 요청을 보낼 수 있음

```typescript
export async function POST(request: Request) {
  const session = await getSession();
  // Origin 확인 없이 바로 처리
  return handle(session, await request.json());
}
```

### 안전
- 개선: GET이 아닌 요청은 Origin과 Host를 비교 (출처: `server/http/handler.ts`, `server/http/sameOrigin.ts`)

```typescript
if (request.method !== "GET") {
  const denied = assertSameOrigin(request); // Origin 없음/불일치면 403
  if (denied) return denied;
}
```

## 2. 입력 검증 누락

### 취약
- 문제: 타입 단언은 검증이 아님. `title`이 객체·초장문이어도 DB까지 도달

```typescript
const body = (await request.json()) as { title: string; description: string };
await addCard(boardId, body);
```

### 안전
- 개선: 서버에서 `zod`로 다시 검증하고 실패하면 400 (출처: `parseBody`)

```typescript
const body = await parseBody(request, createCardBodySchema);
if (!body.ok) return body.response;
await addCard(boardId, body.data); // 검증된 타입만 사용
```

## 3. 계정 열거 + 무차별 대입

### 취약
- 문제: 응답 문구와 시간 차이로 가입된 이메일을 알아내고, 횟수 제한이 없어 비밀번호를 계속 시도할 수 있음

```typescript
const user = await findUserByEmail(email);
if (!user) return { formError: "존재하지 않는 이메일입니다." };
if (!(await verifyPassword(user.passwordHash, password))) {
  return { formError: "비밀번호가 틀렸습니다." };
}
```

### 안전
- 개선: 같은 메시지, 더미 해시로 시간 균등화, 실패 횟수 제한 (출처: `(auth)/actions.ts`, `server/auth/password.ts`, `rateLimit.ts`)

```typescript
if (await isLoginBlocked(email, ip)) return { formError: AUTH_MESSAGES.tooManyAttempts, email };
const user = await findUserByEmail(email);
const valid = user ? await verifyPassword(user.passwordHash, password) : await verifyDummy(password);
await recordLoginAttempt(email, ip, valid);
if (!user || !valid) return { formError: AUTH_MESSAGES.loginFailed, email };
```

## 4. 세션 쿠키 설정

### 취약
- 문제: JS로 쿠키를 읽을 수 있고(XSS 시 탈취), HTTP로도 전송됨. 로그인 전 토큰을 재사용하면 세션 고정 공격 가능

```typescript
(await cookies()).set("session", token); // 옵션 없음
```

### 안전
- 개선: 로그인마다 새 토큰을 발급하고 보안 속성을 지정 (출처: `server/auth/session.ts`)

```typescript
(await cookies()).set(SESSION_COOKIE, token, {
  httpOnly: true,
  secure: isSecureCookie(), // production이면 true
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
});
```

## 5. 프록시 헤더 신뢰 (레이트 리밋 우회)

### 취약
- 문제: 앱이 인터넷에 직접 노출되면 `x-forwarded-for`를 클라이언트가 마음대로 바꿔 IP별 제한을 피할 수 있음

```typescript
export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
```

### 안전
- 개선: 신뢰하는 프록시가 덮어쓴 헤더만 쓰고, IP 제한만 믿지 않도록 이메일 기준 제한도 함께 둠 (이 프로젝트는 이메일·IP 둘 다 제한)

```typescript
// 배포 환경이 설정한 헤더(예: x-real-ip)만 사용하고, 신뢰 가능한 프록시 뒤에서만 운영한다.
const ip = headers.get("x-real-ip") ?? "unknown";
const blocked = byEmail >= MAX || byIp >= MAX; // IP가 위조돼도 이메일 제한은 남음
```

> 현재 코드 `server/auth/rateLimit.ts`의 `getClientIp`가 이 유형이다. Vercel은 `x-forwarded-for`를 클라이언트 값 그대로 이어 붙이지 않고 덮어쓴다고 알려져 있어 Vercel 위에서는 위험이 낮다. 다만 로컬·다른 호스팅에서 같은 코드를 쓰면 위조 가능하므로, 배포 문서로 동작을 확인하고 Vercel 전용 가정임을 주석으로 남긴다.

## 6. Vercel: DB 연결 TLS와 Preview 환경 분리

### 취약
- 문제: TLS 없는 연결은 구간 도청 위험이 있고, Preview 배포가 운영 DB를 쓰면 PR 브랜치 코드가 운영 데이터를 읽고 쓴다

```typescript
// Production과 Preview에 같은 DATABASE_URL, sslmode 지정 없음
DATABASE_URL=postgres://app:pw@db.example.com:5432/kanban
```

### 안전
- 개선: 환경별로 다른 DB를 쓰고, 연결 문자열에 TLS를 지정. 서버리스에서는 풀 크기를 줄이고 DB 제공자의 풀러 주소를 쓴다 (현재 `server/db/pool.ts`는 `max: 10`, TLS는 연결 문자열에 맡김)

```bash
# Vercel Project Settings > Environment Variables
# Production: 운영 DB   /   Preview: 별도 DB   /   Development: 로컬
DATABASE_URL=postgres://app:****@pooler.example.com:5432/kanban?sslmode=verify-full
```

```typescript
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000 });
}
```

> Preview URL은 Vercel의 Deployment Protection으로 보호하고, `sslmode` 값의 정확한 의미는 사용하는 `pg` 버전과 DB 제공자 문서로 확인한다.

## 7. 오류 정보 노출

### 취약
- 문제: 스택·SQL 오류 문구가 응답에 나가 내부 구조가 드러남

```typescript
} catch (error) {
  return Response.json({ error: String(error), stack: (error as Error).stack }, { status: 500 });
}
```

### 안전
- 개선: 응답은 일반 메시지, 상세는 서버 로그에만 (출처: `withSession`의 `serverError`)

```typescript
} catch (error) {
  return serverError(error); // 클라이언트에는 500과 일반 메시지만
}
```
