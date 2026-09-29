# Kanban App — 로그인과 보드 소유권 기술 계획 (Plan)

> 대상 명세: `docs/db-integration/spec.md`
> 기준 코드: `main` (`frontend-setup` 병합 후, 커밋 `6e10275`)

## 1. Original Tech Stack Request (원문)

> 1. database 서버는 postgres를 사용한다.
> 2. postgres mcp를 사용해서 query를 실행한다.

### 요청 해석

| 요청 | 해석과 결정 |
|---|---|
| DB 서버는 postgres | 로컬 PostgreSQL 18.1의 `mydb` DB, `public` 스키마를 쓴다. 명세의 가정 A1이 확정된다. |
| postgres MCP로 query 실행 | 개발·검증 단계의 **모든 확인 쿼리는 postgres MCP로 실행**한다(§10). MCP는 AI 에이전트용 개발 도구라 실행 중인 앱이 호출할 수 없다. 그래서 앱은 Node.js 드라이버 `pg`로 접속한다. |
| (조사 결과) MCP는 읽기 전용 | 2026-09-29에 확인했다. `SELECT`는 되지만 `CREATE TEMP TABLE`은 "Error validating query"로 거부된다. 그래서 **DDL/DML은 repo의 마이그레이션 스크립트로 실행하고, MCP로 결과를 검증**한다. MCP를 쓰기 가능 모드로 바꾸면 DDL도 MCP로 실행할 수 있지만, 스키마 이력은 계속 SQL 파일로 남긴다. |

## 2. Technology Stack (기술 스택)

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 16.3 App Router (유지) | 기존 앱. 인증 구현은 설치된 문서 `02-guides/authentication.md`의 **Database Sessions + DAL + Proxy** 패턴을 따른다. |
| DB | PostgreSQL 18.1 (`mydb`) | 요청 1 |
| DB 드라이버 | `pg` 8.23 (node-postgres), **ORM 없이 SQL 직접 작성** | 앱이 실행하는 SQL과 MCP로 검증하는 SQL이 같은 언어라, MCP `explain_query`에 그대로 넣어 볼 수 있다. `pg`는 Next.js `serverExternalPackages` 기본 목록에 있어 추가 설정이 없다. |
| 마이그레이션 | 버전이 붙은 SQL 파일(`db/migrations/NNNN_*.sql`)과 자체 러너(`scripts/db-migrate.ts`, 약 60줄) | MCP가 읽기 전용이라 DDL 실행 수단이 따로 필요하다. 러너는 `pg`만 쓰고 파일마다 트랜잭션으로 적용하며, 적용 이력은 `schema_migrations`에 남긴다. Node 22의 기본 타입 제거(type stripping)로 `node scripts/db-migrate.ts`처럼 바로 실행한다. |
| 패스워드 해시 | `@node-rs/argon2` 2.2 (argon2id) | 네이티브 빌드가 필요 없는 사전 빌드 바이너리(Windows 포함)를 제공한다. Next.js `serverExternalPackages` 기본 목록에 있다. OWASP 권장 파라미터(m=19 MiB, t=2, p=1)를 쓴다. |
| 세션 | 직접 구현한 DB 세션(불투명 토큰, opaque token) | 로그아웃할 때 서버에서 즉시 무효화해야 한다(FR-8). JWT가 필요 없어서 쿠키 암호화용 비밀 키도 필요 없다. |
| 입력 검증 | zod 4.6 (유지) | 기존 `cardInputSchema`, `statusSchema`를 서버에서도 그대로 쓴다(FR-24). |
| 서버 전용 표시 | `server-only` | DB와 세션 모듈을 실수로 클라이언트 번들에 import하면 빌드가 실패하게 한다(SC-9 보강). |
| 테스트 | Vitest 4 (유지), Playwright 1.63 (유지) | DB 통합 테스트는 Vitest에 `db` 프로젝트를 추가해 실제 PostgreSQL 테스트 DB(`mydb_test`)로 돌린다. |

**선택하지 않은 것**

- **ORM(Drizzle, Prisma)**: 테이블이 5개뿐이고, MCP로 검증하는 흐름에는 SQL을 직접 쓰는 편이 투명하다.
- **Auth.js, Better Auth**: 이메일/패스워드만 필요하고, 소유권 검사는 결국 직접 작성해야 한다. 라이브러리의 스키마 규칙에 맞추는 비용이 더 크다.
- **bcrypt**: 72바이트 입력 한계가 있고, Windows 네이티브 빌드 이슈가 있다. 명세의 72바이트 상한(FR-2)은 호환을 위해 그대로 지킨다.

## 3. Architecture Overview (아키텍처 개요)

```
 Browser
 ├─ /login, /signup ── <form action={serverAction}> ─────────────┐ (Server Action: Origin 검사 내장)
 └─ / (Board, client) ── fetch /api/board/* (JSON) ──────────┐   │
                                                            ▼   ▼
 Next.js server (Node.js runtime)
 ├─ proxy.ts ─────────── 쿠키가 있는지만 보는 낙관적 리다이렉트 (DB 조회 안 함)
 ├─ app/(auth)/…/actions.ts ── signup / login / logout
 ├─ app/api/board/…/route.ts ── Route Handlers (401/404 상태 코드, Origin 검사)
 ├─ app/(board)/page.tsx ── Server Component: verifySession → getBoard → <BoardProvider initialBoard>
 │
 ├─ src/server/auth/   session.ts · password.ts · rateLimit.ts · dal.ts(verifySession)
 ├─ src/server/board/  queries.ts (소유권 조건을 포함한 SQL)
 └─ src/server/db/     pool.ts (전역 싱글턴 Pool) · tx.ts (withTransaction)
                              │ pg
                              ▼
 PostgreSQL 18.1  mydb.public: users · sessions · boards · cards · login_attempts · schema_migrations
                              ▲
 postgres MCP (읽기 전용) ─────┘  스키마·데이터·실행 계획 검증 (개발 중)
```

### 계층과 규칙

1. **Proxy는 낙관적 검사만 한다.** 문서 권고대로 Proxy는 모든 요청(prefetch 포함)에서 실행되므로 DB를 조회하지 않는다. 세션 쿠키가 있는지만 보고 `/` ↔ `/login` 리다이렉트를 결정한다.
2. **진짜 인증은 DAL `verifySession()`에서 한다.** 쿠키 토큰을 SHA-256으로 해시해 `sessions`에서 조회하고, 만료를 확인한 뒤 `{ userId, boardId, email }`을 돌려준다. React `cache`로 요청 하나 안에서는 한 번만 조회한다. 모든 Server Component, Server Action, Route Handler가 이 함수를 거친다.
3. **소유권은 SQL에 넣는다.** `src/server/board/queries.ts`의 모든 함수는 첫 인자로 `boardId`(세션에서 얻은 값)를 받고, 모든 `SELECT/UPDATE/DELETE`에 `AND board_id = $boardId`를 붙인다. 클라이언트가 보낸 `boardId`나 `userId`를 받는 함수 시그니처는 아예 없다(FR-13, NFR-1).
4. **변경은 보드 단위로 직렬화한다.** 모든 카드 변경 트랜잭션은 `SELECT … FROM boards WHERE id = $1 FOR UPDATE`로 보드 행을 잠근 뒤 시작한다. 두 탭에서 동시에 옮겨도 순서가 꼬이지 않는다.
5. **인증 폼은 Server Action, 보드 조작은 Route Handler를 쓴다.** 폼은 Server Action의 기본 CSRF 보호(Origin/Host 비교)와 점진적 향상(progressive enhancement)을 활용한다. 보드 API는 명세가 요구하는 401/404 상태 코드(FR-19, FR-21)를 그대로 내고, Playwright `request`로 격리 테스트(SC-5)를 직접 할 수 있게 Route Handler로 둔다.

### 주요 결정

| # | 결정 | 이유 |
|---|---|---|
| D1 | 이동 API는 `{ toStatus, toIndex }`만 받고, 서버가 순서를 다시 계산한다 | 클라이언트가 여러 카드의 순서를 보내지 않으므로 "다른 유저의 카드가 섞인 다중 변경"(SC-6)이 구조적으로 불가능하다. 서버는 자기 보드의 카드만 다시 번호를 매긴다. |
| D2 | `(board_id, status, position)` UNIQUE를 **DEFERRABLE INITIALLY DEFERRED**로 둔다 | 트랜잭션 중간에 순서를 밀고 당길 때 일시적인 중복을 허용하고, 커밋 시점에만 검사한다. |
| D3 | 카드 `id`는 클라이언트가 UUID v4를 만들어 보내고, 서버는 형식을 검증한다 | 낙관적 추가 뒤 ID를 바꿀 필요가 없다. PK 충돌(`ON CONFLICT DO NOTHING`으로 0행)은 404와 같은 일반 실패로 처리해 존재 여부를 드러내지 않는다. 가져오기(FR-25)는 서버가 ID를 새로 발급한다. |
| D4 | 보드 첫 표시는 Server Component에서 조회해 `initialBoard`로 넘긴다 | 클라이언트 로딩 왕복이 없어 NFR-9(1초 이내)를 만족한다. 기존 `BoardSkeleton`은 `loading.tsx`에서 재사용한다. |
| D5 | 같은 브라우저 탭 간 `storage` 이벤트 동기화는 제거한다 | 저장소가 서버로 바뀌어 `localStorage` 이벤트가 없다. 실시간 동기화는 범위 밖이다(A5). |
| D6 | DB 컬럼 이름은 `position`, 도메인 필드 이름은 `order` | `order`는 SQL 예약어라 따옴표가 필요하다. 매핑은 `queries.ts` 한 곳에서만 한다. |

## 4. Data Models (데이터 모델)

### 4.1 스키마 (`db/migrations/0001_auth_and_board.sql`)

```sql
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE
                    CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  password_hash     text NOT NULL,
  email_verified_at timestamptz,                         -- A3 확장 여지 (이번엔 쓰지 않음)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id          text PRIMARY KEY,                          -- sha256(token) hex. 원문 토큰은 저장하지 않음 (NFR-5)
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,  -- 유저당 1개 (FR-11)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cards (
  id          uuid PRIMARY KEY,
  board_id    uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  status      text NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  position    integer NOT NULL CHECK (position >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cards_board_status_position_key
    UNIQUE (board_id, status, position) DEFERRABLE INITIALLY DEFERRED   -- D2, NFR-11 인덱스 겸용
);

CREATE TABLE login_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        text NOT NULL,
  ip           text NOT NULL,
  succeeded    boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts(email, attempted_at) WHERE NOT succeeded;
CREATE INDEX login_attempts_ip_idx    ON login_attempts(ip, attempted_at)    WHERE NOT succeeded;
```

- `schema_migrations(version text PRIMARY KEY, applied_at timestamptz)`는 러너가 만든다.
- `gen_random_uuid()`는 PostgreSQL 13 이상에 내장되어 있어 확장(extension)이 필요 없다.
- **길이 기준 차이**: zod `max(100)`은 UTF-16 코드 유닛을 세고, `char_length`는 코드 포인트를 센다. zod 쪽이 항상 같거나 더 엄격하므로, zod를 통과한 입력이 DB CHECK에 걸리는 경우는 없다. DB CHECK는 최후 방어선이다.
- 상태 값은 `enum` 타입 대신 CHECK를 쓴다. 나중에 상태를 추가할 때 `ALTER TYPE` 없이 CHECK만 바꾸면 된다.

### 4.2 도메인 타입 (변경 없음)

`src/lib/board/types.ts`의 `Card`와 `BoardState`는 그대로다. 서버는 `cards` 행을 `status`, `position` 순으로 읽어 `columns[status]`에 ID를 넣고, `cards[id]`에 `order = position`으로 매핑한다. 행→도메인 변환은 `rowsToBoard(rows)` 순수 함수로 만들어 단위 테스트한다.

### 4.3 세션 토큰

- 토큰: `crypto.randomBytes(32).toString("base64url")` (256비트)
- 쿠키: `kanban_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800; Secure(프로덕션)`
- DB: `sessions.id = sha256(token)`. DB가 유출되어도 토큰을 복원할 수 없다.
- 로그인할 때마다 새 토큰을 발급하고(NFR-8), 같은 유저의 만료된 세션은 이때 정리한다.

## 5. API Design (API 설계)

### 5.1 Server Actions (인증) — `src/app/(auth)/actions.ts`

| 액션 | 입력 (FormData) | 동작 | 결과 |
|---|---|---|---|
| `signup` | `email`, `password`, `passwordConfirm` | zod 검증 → argon2 해시 → 트랜잭션(`users` INSERT, `boards` INSERT) → 세션 생성 | 성공하면 `redirect("/")`. `email` UNIQUE 위반(23505)이면 `{ fieldErrors: { email: "이미 가입된 이메일입니다." } }` |
| `login` | `email`, `password` | 시도 제한 검사 → 유저 조회 → argon2 검증(유저가 없으면 더미 해시로 검증, NFR-3) → 시도 기록 → 세션 생성 | 성공하면 `redirect("/")`. 실패하면 `{ formError: "이메일 또는 패스워드가 올바르지 않습니다." }`, 제한에 걸리면 `{ formError: "로그인 시도가 너무 많습니다. 15분 뒤 다시 시도하세요." }` |
| `logout` | — | `sessions` DELETE, 쿠키 삭제 | `redirect("/login")` |

입력 스키마(`src/lib/auth/schema.ts`, 클라이언트와 서버 공용):

```ts
email:    z.string().trim().toLowerCase().pipe(z.email().max(254))
password: z.string().min(8).refine(s => new TextEncoder().encode(s).length <= 72, "72바이트 이하")
signup:   z.object({ email, password, passwordConfirm }).refine(v => v.password === v.passwordConfirm)
```

**시도 제한 (NFR-2)**: 최근 15분 동안 같은 `email`의 실패가 10회 이상이거나 같은 `ip`의 실패가 10회 이상이면 거부한다. 이때는 해시 검증을 하지 않고, 시도 기록도 남기지 않는다. IP는 `x-forwarded-for`의 첫 값을 쓰고, 없으면 `"local"`로 둔다. 11번째 시도가 거부된다(SC-9).

### 5.2 Route Handlers (보드) — 모두 `verifySession()` 필수

공통 규칙

- 세션이 없거나 만료되면 **401** `{ error: "unauthorized" }`
- 대상 카드가 없거나 다른 유저의 카드이면 **404** `{ error: "not_found" }` (FR-19)
- zod 검증에 실패하면 **400** `{ error: "invalid", fieldErrors }`
- 그 밖의 오류는 **500** `{ error: "server" }`. SQL이나 스택은 서버 로그에만 남긴다.
- 상태를 바꾸는 메서드는 `Origin` 헤더의 호스트가 `Host`(또는 `X-Forwarded-Host`)와 다르면 **403**을 돌려준다(NFR-4, `assertSameOrigin`).
- 응답 헤더에 `Cache-Control: no-store`를 붙인다.

| 메서드 · 경로 | 요청 | 성공 응답 | SQL 요지 |
|---|---|---|---|
| `GET /api/board` | — | 200 `BoardState` | `SELECT … FROM cards WHERE board_id=$1 ORDER BY status, position` |
| `POST /api/board/cards` | `{ id: uuid, title, description }` | 201 `Card` | 보드 잠금 → `INSERT … (board_id=$session, status='TODO', position=(TODO 개수)) ON CONFLICT (id) DO NOTHING` → 0행이면 404 |
| `PATCH /api/board/cards/:id` | `{ title, description }` | 200 `Card` | `UPDATE cards SET … WHERE id=$1 AND board_id=$2 RETURNING *` → 0행이면 404 |
| `DELETE /api/board/cards/:id` | — | 204 | 보드 잠금 → `DELETE … WHERE id=$1 AND board_id=$2 RETURNING status, position` → 0행이면 404 → 같은 컬럼 뒤쪽 카드 `position - 1` |
| `POST /api/board/cards/:id/move` | `{ toStatus, toIndex }` | 200 `BoardState` | 보드 잠금 → 대상 카드 조회(`AND board_id`) → 0행이면 404 → 원래 컬럼과 대상 컬럼의 ID 배열을 계산(기존 `moveCard` 순수 함수 재사용) → `UPDATE cards c SET status=v.status, position=v.pos FROM unnest($ids, $statuses, $positions) v(...) WHERE c.id=v.id AND c.board_id=$board` → 갱신 행 수가 예상과 다르면 ROLLBACK 후 404 |
| `POST /api/board/import` | `StoredBoard` (기존 `localStorage` 형식) | 200 `BoardState` | 보드 잠금 → 카드가 이미 있으면 409 → `storedBoardSchema` 검증 → 서버가 새 UUID를 발급해 일괄 INSERT |

- 이동 응답으로 보드 전체를 돌려주면, 클라이언트는 서버 기준 순서로 조정(reconcile)할 수 있다.
- `toIndex`가 대상 컬럼 길이보다 크면 서버가 끝 위치로 맞춘다(clamp).

### 5.3 클라이언트 저장소 인터페이스 (비동기로 변경)

```ts
// src/lib/storage/boardRepository.ts
export type RepoError = "unauthorized" | "not_found" | "invalid" | "conflict" | "network" | "server";
export type RepoResult<T = void> = { ok: true; value: T } | { ok: false; error: RepoError };

export interface BoardRepository {
  addCard(input: { id: string; title: string; description: string }): Promise<RepoResult<Card>>;
  updateCard(id: string, input: { title: string; description: string }): Promise<RepoResult<Card>>;
  deleteCard(id: string): Promise<RepoResult>;
  moveCard(id: string, toStatus: Status, toIndex: number): Promise<RepoResult<BoardState>>;
  importBoard(stored: StoredBoard): Promise<RepoResult<BoardState>>;
}
```

- `apiBoardRepository` (`src/lib/storage/apiBoardRepository.ts`): `fetch`로 구현하고 HTTP 상태를 `RepoError`로 바꾼다.
- `localStorageBoardRepository`는 **가져오기 원본을 읽는 용도**(`load()`)로만 남긴다. 파일 이름과 모듈은 유지하되 `BoardRepository` 구현에서는 뺀다.
- 테스트용으로 `createMemoryBoardRepository()`를 추가해 컴포넌트 테스트에서 네트워크 없이 쓴다.

## 6. Component Structure (컴포넌트 구조)

### 6.1 디렉터리 (추가·변경분)

```
db/migrations/0001_auth_and_board.sql
scripts/db-migrate.ts                 # up / status. 대상은 DATABASE_URL
scripts/db-test-setup.ts              # mydb_test 생성(없으면) + 마이그레이션 + TRUNCATE
proxy.ts                              # 낙관적 리다이렉트 (src/ 기준 위치는 문서 확인 후 확정)
src/app/
  (auth)/layout.tsx                   # 가운데 카드 레이아웃
  (auth)/login/page.tsx
  (auth)/signup/page.tsx
  (auth)/actions.ts                   # "use server": signup, login, logout
  (board)/layout.tsx                  # AppHeader(이메일, 로그아웃)
  (board)/page.tsx                    # 기존 src/app/page.tsx를 이동. Server Component
  (board)/loading.tsx                 # BoardSkeleton 재사용
  api/board/route.ts                  # GET
  api/board/cards/route.ts            # POST
  api/board/cards/[id]/route.ts       # PATCH, DELETE
  api/board/cards/[id]/move/route.ts  # POST
  api/board/import/route.ts           # POST
src/server/                           # 모든 파일 첫 줄에 import "server-only"
  db/pool.ts  db/tx.ts
  auth/password.ts  auth/session.ts  auth/rateLimit.ts  auth/dal.ts
  board/queries.ts  board/rowsToBoard.ts
  http/respond.ts  http/sameOrigin.ts
src/lib/auth/schema.ts                # 클라이언트·서버 공용 zod
src/lib/storage/apiBoardRepository.ts
src/lib/storage/memoryBoardRepository.ts
src/components/auth/LoginForm.tsx      # "use client", useActionState
src/components/auth/SignupForm.tsx
src/components/auth/PasswordField.tsx  # 표시/숨김 토글 (NFR-14)
src/components/layout/AppHeader.tsx    # 이메일 + <form action={logout}>
src/components/board/ImportPrompt.tsx  # FR-25 가져오기 확인 (기존 ConfirmDialog 재사용)
```

### 6.2 계층 구조

```
RootLayout
├─ (auth)/layout ─ LoginPage ─ LoginForm ─ PasswordField
│                └ SignupPage ─ SignupForm ─ PasswordField ×2
└─ (board)/layout ─ AppHeader
                  └ BoardPage (server: verifySession → getBoard)
                      └ BoardProvider initialBoard repository=apiBoardRepository
                          ├─ ImportPrompt   (보드가 비어 있고 localStorage에 데이터가 있을 때)
                          ├─ Board (기존 그대로: Column, SortableCard, CardFormDialog, ConfirmDialog)
                          └─ Toast
```

### 6.3 폼 접근성 (NFR-12, 14)

- `<label htmlFor>`를 모든 입력에 연결한다. 필드 오류는 `aria-describedby`와 `aria-invalid`로, 폼 오류는 `role="alert"`로 알린다.
- 자동완성: 로그인은 `email`, `current-password`, 가입은 `email`, `new-password`를 지정한다.
- 제출 중에는 버튼을 `aria-disabled`로 두고 "처리 중…"을 표시한다(`useActionState`의 `pending`).
- 실패하면 첫 번째 오류 필드로 포커스를 옮긴다.

## 7. State Management (상태 관리)

### 7.1 BoardProvider 변경

| 항목 | 이전 | 이후 |
|---|---|---|
| 초기 상태 | `repository.load()` (클라이언트) | props `initialBoard` (서버 조회 결과). `isHydrated`는 즉시 true |
| `commit(action)` | 동기 `save(next)` → `boolean` | ① 리듀서로 낙관적 적용 ② **커밋 큐**(Promise 체인)에 서버 호출 등록 ③ 성공하면 `lastSaved` 갱신(이동은 서버가 준 보드로 조정) ④ 실패하면 `RESTORE(lastSaved)`와 토스트. 반환 타입은 `Promise<boolean>` |
| 401 | — | 토스트 "로그인이 만료되었습니다." 후 `router.replace("/login")` |
| 탭 간 동기화 | `storage` 이벤트 | 제거 (D5) |

**커밋 큐를 쓰는 이유**: 드래그를 빠르게 두 번 하면 요청 두 개가 겹친다. 큐로 순서대로 보내고, 실패하면 그 뒤에 대기 중인 낙관적 변경까지 모두 `lastSaved`로 되돌린다. 확정된 상태만 기준으로 삼으므로 화면과 DB가 어긋나지 않는다(FR-22, 23).

### 7.2 데이터 흐름 — 카드 이동

```
drop → useBoardDnd → commit(MOVE_CARD)
  → boardReducer (화면 즉시 반영, 60fps 유지)
  → queue: apiBoardRepository.moveCard(id, toStatus, toIndex)
       → POST /api/board/cards/:id/move
           → verifySession → assertSameOrigin → zod
           → withTransaction: lock board → select card (owner) → recompute → UPDATE … unnest
       ← 200 BoardState → HYDRATE(서버 보드), lastSaved = 서버 보드
       ← 4xx/5xx      → RESTORE(lastSaved) + Toast
```

### 7.3 가져오기 흐름 (FR-25)

`BoardProvider`가 마운트되고 `initialBoard`가 비어 있으면, `localStorageBoardRepository.load()`로 원본을 읽는다. 유효하면 `ImportPrompt`를 연다. 확인하면 `importBoard`를 호출하고, 성공하면 원본을 `kanban-app:board:imported-<timestamp>`로 옮긴다. 취소하면 이번 로그인 세션 동안 다시 묻지 않는다(`sessionStorage` 표시).

## 8. Security Considerations (보안 고려사항)

| 위협 | 대책 | 명세 |
|---|---|---|
| 다른 유저 아이템 접근 (IDOR) | 모든 쿼리에 `board_id = <세션 보드>` 조건을 넣는다. `boardId`와 `userId`를 입력으로 받는 API는 없다. 404로 통일한다. | FR-13~19, NFR-1 |
| 확인과 수정 사이의 경쟁(TOCTOU) | 확인과 변경을 한 SQL 문(또는 보드 행 잠금 트랜잭션)에서 한다. | FR-18 |
| 다중 변경에 다른 유저 카드 혼입 | 클라이언트가 카드 목록을 보내지 않는다(D1). 갱신 행 수가 다르면 ROLLBACK한다. | FR-20, SC-6 |
| 패스워드 유출 | argon2id로 해시한다. 로그에 폼 데이터를 남기지 않는다. | FR-3, NFR-5 |
| 세션 탈취·고정 | HttpOnly, SameSite=Lax 쿠키를 쓰고 프로덕션에서는 Secure를 켠다. 로그인할 때마다 새 토큰을 발급하고, DB에는 해시만 저장한다. | FR-7, NFR-5, 8 |
| 계정 열거 | 로그인 실패 메시지를 하나로 통일하고, 유저가 없으면 더미 해시로 검증한다(시간 균일화). 가입 중복 메시지는 명세 FR-5에 따라 노출한다(가입 폼 특성상 허용). | FR-6, NFR-3 |
| 무차별 대입 | `login_attempts`로 이메일과 IP별 15분 10회 제한을 둔다. | NFR-2 |
| CSRF | Server Action은 내장 Origin 검사를 쓴다. Route Handler는 `assertSameOrigin`을 쓴다. 두 쪽 모두 SameSite=Lax 쿠키다. | NFR-4 |
| SQL 인젝션 | `pg` 파라미터 바인딩(`$1`)만 쓴다. ESLint `no-restricted-syntax`로 `query()`에 템플릿 리터럴을 넘기지 못하게 막는다. | NFR-6 |
| 비밀 노출 | `DATABASE_URL`은 `.env.local`에만 두고 `NEXT_PUBLIC_` 접두사를 쓰지 않는다. `src/server/**`는 `server-only`로 표시한다. `.env.example`만 커밋한다(`.gitignore`에 `!.env.example` 추가). | SC-9 |
| XSS와 CSP | 기존 정책을 유지한다. 새 화면도 React 텍스트 출력만 쓴다. `form-action 'self'`로 Server Action 폼이 허용되는지 확인한다. | NFR-7 |
| 앱 DB 계정 권한 | 로컬은 `postgres`를 쓴다. 운영에서는 `kanban_app` 역할에 테이블 5개의 `SELECT/INSERT/UPDATE/DELETE`만 준다(마이그레이션 계정과 분리). | 명세 A4 계열 |

## 9. Testing Strategy (테스트 전략)

### 9.1 단위 테스트 — Vitest, jsdom (`tests/unit`, 기존 유지와 확장)

- `lib/auth/schema`: 이메일 정규화(대소문자, 공백), 패스워드 8자와 72바이트 경계(한글 3바이트 포함), 확인 불일치
- `server/board/rowsToBoard`: 정렬, `order` 매핑, 빈 보드
- `lib/storage/apiBoardRepository`: `fetch` 모킹으로 상태 코드 → `RepoError` 변환(401, 404, 400, 409, 500, 네트워크 오류)
- `BoardProvider`: `memoryBoardRepository`로 낙관적 적용, 실패 롤백, **커밋 큐 연쇄 롤백**, 401 → `/login` 이동
- `LoginForm`, `SignupForm`: 레이블 연결, 오류 표시와 포커스 이동, 패스워드 표시 토글

### 9.2 DB 통합 테스트 — Vitest `db` 프로젝트, Node 환경 (`tests/db`, 신규)

- 대상은 **`mydb_test`**(`TEST_DATABASE_URL`)이다. `globalSetup`에서 `scripts/db-test-setup.ts`를 실행하고, 각 테스트 전에 `TRUNCATE users CASCADE`로 비운다.
- `signup`: 유저와 보드가 함께 만들어진다. 보드 INSERT가 실패하면 유저도 롤백된다. 이메일 중복은 23505다.
- `session`: 토큰 원문이 DB에 없다(`sessions.id`는 64자 hex). 만료된 세션은 거부된다. 로그아웃하면 행이 삭제된다.
- `rateLimit`: 실패 10회 뒤 11번째는 거부된다. 15분이 지나면 풀린다(시간 주입).
- **격리 (SC-5, 6)**: 유저 A와 B를 만들고, B의 `boardId`로 A의 카드에 `update/delete/move`를 호출하면 전부 `not_found`이고 A의 행은 그대로다. `getBoard(B)`에 A의 카드가 없다.
- **트랜잭션 (SC-6, NFR-10)**: 이동 중 강제로 오류를 내면(모의 실패 훅) `position`이 모두 원래대로 돌아간다.
- **동시성 (NFR-9)**: 같은 보드에 `move` 두 개를 `Promise.all`로 보내도 UNIQUE 위반이 없고, 최종 순서가 0..n-1로 연속된다.
- **DB 제약 (SC-4)**: 101자 제목, 빈 제목, 잘못된 status를 SQL로 직접 INSERT하면 CHECK 위반(23514)이 난다.

### 9.3 E2E — Playwright (`tests/e2e`, 기존 보완과 신규)

- `webServer.env`: `DATABASE_URL = TEST_DATABASE_URL`. `globalSetup`에서 테스트 DB를 초기화한다.
- **인증 fixture** (`tests/e2e/fixtures.ts`): 테스트마다 고유 이메일(`e2e+<uuid>@test.local`)로 가입하고 `storageState`를 재사용한다. 기존 spec(board, dnd, a11y, mobile, performance, security, smoke)은 이 fixture로 로그인한 상태에서 실행한다. `openWith(localStorage 주입)` 헬퍼는 **API 시드**(`POST /api/board/cards` 연속 호출)로 바꾼다.
- `persistence.spec.ts`를 수정한다. 새로고침과 **새 브라우저 컨텍스트로 다시 로그인**했을 때 같은 보드가 보이는지 확인한다(SC-7).
- 신규 `auth.spec.ts`: 가입 → 빈 보드(SC-1), 중복 가입(SC-2), 로그인 실패 메시지 동일(SC-3), 로그아웃 → 리다이렉트와 API 401(SC-4), 11번째 실패 시 제한 메시지(SC-9)
- 신규 `authz.spec.ts`: 컨텍스트 두 개(A, B)로 B의 `request`를 A의 카드 ID에 `PATCH/DELETE/move` → 404, B의 `GET /api/board`에 A의 카드 없음(SC-5)
- 신규 `import.spec.ts`: `localStorage`에 기존 형식을 주입하고 로그인 → 가져오기 확인 → 카드 수, 순서, 상태가 같은지(FR-25)
- `security.spec.ts` 추가: 다른 Origin으로 보낸 POST → 403, 응답에 SQL이나 스택 문자열 없음
- `a11y.spec.ts` 추가: `/login`, `/signup`에서 axe 위반 0건(NFR-13)
- `performance.spec.ts` 추가: 카드 100개를 시드한 뒤 보드 첫 표시 1초 이내(NFR-9), 이동 API p95 150ms(NFR-10, `page.waitForResponse` 시간 측정 20회)

### 9.4 postgres MCP 검증 체크리스트 (개발 중, `mydb` 대상)

구현 단계마다 아래 쿼리를 **postgres MCP로 실행**하고, 결과를 tasks.md의 해당 작업에 기록한다.

| 시점 | MCP 도구 / 쿼리 | 기대 결과 |
|---|---|---|
| 마이그레이션 적용 후 | `list_objects(schema_name="public")` | `users, sessions, boards, cards, login_attempts, schema_migrations` |
| 〃 | `get_object_details("public","cards")` | 컬럼, CHECK 3개, FK, `cards_board_status_position_key` (deferrable) |
| 〃 | `SELECT conname, pg_get_constraintdef(oid), condeferrable FROM pg_constraint WHERE conrelid='cards'::regclass` | D2 확인 |
| 가입 후 | `SELECT u.email, b.id FROM users u JOIN boards b ON b.user_id=u.id` | 유저당 보드 1개, 이메일은 소문자 |
| 〃 | `SELECT length(id), length(password_hash) > 50 FROM sessions, users` | 세션 ID 64자, 해시 저장 (SC-8) |
| 보드 조작 후 | `SELECT status, position, title FROM cards WHERE board_id=$보드 ORDER BY status, position` | 화면과 동일하고 position이 0..n-1로 연속 (SC-2) |
| 성능 | `explain_query("SELECT … FROM cards WHERE board_id=… ORDER BY status, position")` | `cards_board_status_position_key` 인덱스 사용(데이터가 적을 때 Seq Scan 허용) |
| 전체 | `analyze_db_health()` | 인덱스와 제약에 경고 없음 |

## 10. Deployment Plan (배포 계획)

### 10.1 스크립트 (`package.json` 추가)

```jsonc
"db:migrate":     "node scripts/db-migrate.ts up",
"db:status":      "node scripts/db-migrate.ts status",
"db:test:setup":  "node scripts/db-test-setup.ts",
"test":           "vitest run --project unit",
"test:db":        "vitest run --project db",
"test:e2e":       "npm run db:test:setup && playwright test"
```

스크립트는 `process.loadEnvFile(".env.local")`(Node 21.7 이상 내장)로 환경 변수를 읽는다. `dotenv`는 필요 없다.

### 10.2 환경 변수

| 이름 | 예시 | 용도 |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:***@localhost:5432/mydb` | 앱과 마이그레이션 |
| `TEST_DATABASE_URL` | `postgres://postgres:***@localhost:5432/mydb_test` | DB 통합 테스트와 E2E |
| `SESSION_COOKIE_SECURE` | (생략 시 `NODE_ENV==="production"`) | 로컬 http에서 프로덕션 빌드로 E2E를 돌릴 때 `false` |

`.env.example`에 값 없이 키만 커밋한다. `.gitignore`에는 `!.env.example`을 추가한다.

### 10.3 로컬 실행 순서

1. `.env.local`을 작성한다.
2. `npm run db:migrate`로 `mydb`에 스키마를 적용한다.
3. **postgres MCP로 §9.4의 마이그레이션 검증을 한다.**
4. `npm run dev`로 실행하고 `/signup`에서 가입한다.

### 10.4 렌더링 변화

보드 페이지가 `cookies()`를 읽으므로 **동적 렌더링**이 된다. 지금 CSP 주석에 있는 "정적 렌더링" 전제는 더 이상 맞지 않는다. 이번에는 정책을 유지하고 주석만 고친다. nonce 기반 CSP 전환은 후속 과제로 남긴다.

### 10.5 향후 운영 배포 (범위 밖, 참고)

Vercel에 배포할 때는 Marketplace의 PostgreSQL(예: Neon)을 프로비저닝하고, `DATABASE_URL`을 Vercel 환경 변수로 넣는다. 빌드 단계 전에 `db:migrate`를 실행한다. 앱 역할은 최소 권한 계정으로 분리한다.

## 11. Dependencies (의존성)

### 11.1 dependencies (추가)

| 패키지 | 버전 | 용도 |
|---|---|---|
| `pg` | 8.23.0 | PostgreSQL 드라이버 |
| `@node-rs/argon2` | 2.2.1 | 패스워드 해시 |
| `server-only` | 0.0.1 | 서버 모듈이 클라이언트로 새는 것 방지 |

### 11.2 devDependencies (추가)

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@types/pg` | 8.23.1 | 타입 |

기존 의존성(Next 16.3.6, React 19.3, zod 4.6.5, dnd-kit, Vitest 4.1, Playwright 1.63)은 그대로 둔다.

### 11.3 버전 원칙

- 기존과 같이 정확한 버전으로 고정한다(`.npmrc`의 `save-exact` 유지).
- Node 22.22 기준이다. `process.loadEnvFile`과 기본 타입 제거가 동작하려면 `engines.node`를 `>=22.18.0`으로 올려야 한다.
