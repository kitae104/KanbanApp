# 🔴 HIGH 취약점 예시

## 1. SQL 인젝션

### 취약
- 문제: 입력이 SQL 문자열에 섞여 `'; DROP TABLE cards; --` 같은 입력이 쿼리가 됨

```typescript
const { rows } = await query(
  `SELECT * FROM cards WHERE board_id = '${boardId}' AND title = '${title}'`,
);
```

### 안전
- 개선: 값은 항상 `$1, $2` 파라미터로 전달 (이 프로젝트의 `queries.ts` 방식)

```typescript
const { rows } = await query(
  "SELECT id, title FROM cards WHERE board_id = $1 AND title = $2",
  [boardId, title],
);
```

> 정렬 컬럼·테이블명처럼 파라미터로 못 넣는 값은 허용 목록(`Set`/`switch`)으로만 선택한다.

## 2. 권한 우회 (IDOR)

### 취약
- 문제: 요청 본문의 `boardId`를 믿어서 다른 사용자의 보드를 읽고 지울 수 있음

```typescript
export async function DELETE(request: Request) {
  const { boardId, cardId } = await request.json();
  await query("DELETE FROM cards WHERE id = $1 AND board_id = $2", [cardId, boardId]);
  return new Response(null, { status: 204 });
}
```

### 안전
- 개선: `boardId`는 세션에서만 얻고, 모든 SQL에 `board_id` 조건을 넣음 (출처: `server/http/handler.ts`, `server/board/queries.ts`)

```typescript
export function DELETE(request: Request, { params }: Context) {
  return withSession(request, async ({ boardId }) => {
    const { id } = await params;
    const result = await deleteCard(boardId, id); // WHERE id = $1 AND board_id = $2
    return result.ok ? new Response(null, { status: 204 }) : notFound();
  });
}
```

## 3. 인증 누락 (Server Action 포함)

### 취약
- 문제: Server Action은 공개 URL로 호출 가능한데 세션 확인이 없음

```typescript
"use server";
export async function deleteAllCards(boardId: string) {
  await query("DELETE FROM cards WHERE board_id = $1", [boardId]);
}
```

### 안전
- 개선: 함수 안에서 세션을 확인하고 `boardId`는 세션에서 꺼냄

```typescript
"use server";
export async function deleteAllCards() {
  const session = await getSession();
  if (!session) redirect("/login");
  await query("DELETE FROM cards WHERE board_id = $1", [session.boardId]);
}
```

## 4. XSS

### 취약
- 문제: 카드 설명에 `<img src=x onerror=...>`를 넣으면 다른 화면에서 스크립트가 실행됨

```tsx
<p dangerouslySetInnerHTML={{ __html: card.description }} />
```

### 안전
- 개선: React의 텍스트 출력(자동 이스케이프)을 사용. HTML이 꼭 필요하면 검증된 sanitizer를 거침

```tsx
<p>{card.description}</p>
```

## 5. 비밀 노출

### 취약
- 문제: `NEXT_PUBLIC_` 값은 브라우저 번들에 그대로 들어감. 코드에 박은 값은 git 이력에 남음

```typescript
const pool = new Pool({ connectionString: "postgres://admin:pw1234@db:5432/kanban" });
// .env: NEXT_PUBLIC_DATABASE_URL=postgres://...
```

### 안전
- 개선: 서버 전용 환경 변수를 서버 모듈에서만 읽고(`server-only`), `.env.local`은 커밋하지 않음

```typescript
import "server-only";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

## 6. 약한 비밀번호/세션 토큰 저장

### 취약
- 문제: DB가 유출되면 비밀번호가 바로 노출되고, 세션 토큰 원문으로 로그인할 수 있음

```typescript
await query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, password]);
await query("INSERT INTO sessions (id, user_id) VALUES ($1, $2)", [token, userId]);
```

### 안전
- 개선: 비밀번호는 argon2id, 세션 토큰은 sha256 해시만 저장 (출처: `server/auth/password.ts`, `server/auth/session.ts`)

```typescript
await query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [email, await hashPassword(password)]);
await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [
  hashToken(token), userId, expiresAt,
]);
```
