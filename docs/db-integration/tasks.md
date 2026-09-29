# Kanban App — 로그인과 보드 소유권 작업 목록 (Tasks)

> 기준 문서: [`spec.md`](./spec.md) · [`plan.md`](./plan.md)
> 작성일: 2026-09-29 · 브랜치: `db-integration`

## 개요

- 총 **32개 작업**, **8개 그룹**
- 작업은 의존성 순서대로 정렬했다. **Depends on**에 적은 작업이 끝나야 시작할 수 있다. 같은 그룹 안에서 서로 의존하지 않는 작업은 병렬로 진행해도 된다.
- **Status**: ⬜ Todo → ⏳ In progress → ✅ Done 순으로 갱신한다.
- **Required**: `Yes`는 명세의 요구사항이나 성공 기준을 채우는 데 필요한 작업이다. `No`는 품질을 보강하는 작업이라 빠져도 명세 충족에는 지장이 없다.
- 서버 로직은 **테스트를 먼저 쓰고(TDD)** 구현한다. 각 작업의 "완료 조건"은 명령, 테스트, **postgres MCP 쿼리**로 확인할 수 있게 적었다.
- **postgres MCP는 읽기 전용이다**(plan §1). DDL과 DML은 `npm run db:*` 스크립트로 실행하고, 결과는 MCP로 검증한다. MCP 검증 결과(쿼리와 요약)는 해당 작업의 "구현 메모"에 남긴다.
- Next.js 16 API(Proxy, `cookies()`, Server Action, Route Handler)를 쓰는 작업은 시작하기 전에 `node_modules/next/dist/docs/`의 해당 문서를 확인한다(AGENTS.md).

| 그룹 | 작업 | 복잡도 |
| --- | --- | --- |
| G1. 환경과 DB 기반 | T-001 ~ T-005 | Medium |
| G2. 인증 코어 | T-006 ~ T-010 | High |
| G3. 보드 데이터 계층 | T-011 ~ T-015 | High |
| G4. 인증 흐름과 라우팅 | T-016 ~ T-019 | Medium |
| G5. 보드 API | T-020 ~ T-021 | Medium |
| G6. 클라이언트 연동 | T-022 ~ T-024 | High |
| G7. 보안과 성능 점검 | T-025 ~ T-026 | Medium |
| G8. E2E 테스트와 마무리 | T-027 ~ T-032 | High |

---

## G1. 환경과 DB 기반 (복잡도: Medium)

### T-001 의존성 추가와 환경 변수 틀
- **Purpose**: DB 연결과 패스워드 해시에 필요한 패키지를 설치하고, 비밀 값이 커밋되지 않는 환경 변수 구조를 만든다(plan §10.2, §11, SC-9).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: —
- **작업 내용**
  - `npm install pg@8.23.0 @node-rs/argon2@2.2.1 server-only@0.0.1`, `npm install -D @types/pg@8.23.1`을 실행한다.
  - `package.json`의 `engines.node`를 `>=22.18.0`으로 올린다.
  - `.env.example`을 만든다(`DATABASE_URL=`, `TEST_DATABASE_URL=`, `SESSION_COOKIE_SECURE=`처럼 키만 둔다). `.gitignore`에 `!.env.example`을 추가한다.
  - `.env.local`은 개발자가 직접 작성한다(`mydb`, `mydb_test` 접속 문자열).
- **완료 조건**: `npm ls pg @node-rs/argon2 server-only`에 정확한 버전이 표시된다. `git status`에 `.env.example`만 보이고 `.env.local`은 보이지 않는다. `npm run typecheck`가 통과한다.

### T-002 DB 커넥션 풀과 트랜잭션 헬퍼
- **Purpose**: 모든 서버 코드가 쓰는 DB 접근 경로를 하나로 만들고, 개발 모드 핫 리로드 때 커넥션이 새지 않게 한다(plan §3, §6.1).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-001
- **작업 내용**
  - `src/server/db/pool.ts`: `import "server-only"`를 넣는다. `globalThis`에 `pg.Pool` 싱글턴을 두고, `DATABASE_URL`이 없으면 명확한 오류를 던진다. `query<T>(text, params)` 래퍼를 제공한다.
  - `src/server/db/tx.ts`: `withTransaction(fn)`은 `BEGIN` → `fn(client)` → `COMMIT`을 하고, 예외가 나면 `ROLLBACK`한 뒤 client를 반환한다.
  - 테스트에서 연결 대상을 바꿀 수 있게 `createPool(url)`도 export한다.
- **완료 조건**: T-004의 DB 테스트에서 `withTransaction` 안에서 예외가 나면 INSERT가 롤백되고, 정상이면 커밋된다. 클라이언트 컴포넌트에서 `pool.ts`를 import하면 `npm run build`가 실패한다(확인 후 되돌림).

### T-003 마이그레이션 러너와 초기 스키마
- **Purpose**: MCP가 읽기 전용이라 DDL을 실행할 수단을 만들고, 명세의 데이터 제약을 DB 수준에서 강제한다(plan §4.1, FR-11, FR-14, SC-4).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-001
- **작업 내용**
  - `db/migrations/0001_auth_and_board.sql`: plan §4.1의 `users`, `sessions`, `boards`, `cards`, `login_attempts` 테이블과 인덱스, CHECK 제약, `DEFERRABLE` UNIQUE를 만든다.
  - `scripts/db-migrate.ts`: `process.loadEnvFile(".env.local")`로 환경 변수를 읽는다. `schema_migrations`를 만들고(없을 때만), 적용하지 않은 파일을 이름순으로 파일마다 트랜잭션으로 적용한다. `up`과 `status` 하위 명령을 지원한다.
  - `package.json` scripts에 `db:migrate`와 `db:status`를 추가한다.
  - `npm run db:migrate`로 `mydb`에 적용한다.
- **완료 조건**
  - `npm run db:migrate`를 두 번 실행해도 두 번째는 "적용할 마이그레이션 없음"이다(멱등).
  - **postgres MCP 검증**:
    - `list_objects(schema_name="public")` → 테이블 6개가 있다.
    - `get_object_details("public","cards")` → CHECK 3개, FK, `cards_board_status_position_key`가 있다.
    - `SELECT conname, condeferrable, condeferred FROM pg_constraint WHERE conrelid='cards'::regclass` → UNIQUE가 `deferrable=true, deferred=true`이다.

### T-004 테스트 DB와 Vitest 프로젝트 분리
- **Purpose**: 개발 DB(`mydb`)를 건드리지 않고, 실제 PostgreSQL로 통합 테스트를 돌릴 수 있게 한다(plan §9.2).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-002, T-003
- **작업 내용**
  - `scripts/db-test-setup.ts`: `TEST_DATABASE_URL`의 DB가 없으면 `postgres` DB에 접속해 `CREATE DATABASE mydb_test`를 실행한다. 그다음 마이그레이션을 적용하고 모든 테이블을 `TRUNCATE`한다.
  - `vitest.config.mts`를 `projects`로 나눈다. `unit`은 jsdom과 `tests/unit`, `db`는 node 환경과 `tests/db`, 그리고 `globalSetup`, `fileParallelism: false`로 둔다.
  - `tests/db/helpers.ts`: 테스트 전용 풀(`TEST_DATABASE_URL`), `resetDb()`(`TRUNCATE users, login_attempts RESTART IDENTITY CASCADE`), 유저·보드 생성 팩토리를 둔다.
  - scripts를 정리한다: `test`는 `vitest run --project unit`, `test:db`는 `vitest run --project db`, `db:test:setup`을 추가한다.
- **완료 조건**: `npm test`(기존 단위 테스트)가 전부 통과한다. `npm run test:db`가 T-002 트랜잭션 테스트 한 건으로 통과한다. postgres MCP로 `SELECT datname FROM pg_database WHERE datname='mydb_test'` → 1행이 나온다.

### T-005 SQL 인젝션 방지 lint 규칙
- **Purpose**: `query()`에 문자열 보간을 넘기는 코드를 정적으로 막는다(NFR-6).
- **Required**: No
- **Status**: ✅ Done
- **Depends on**: T-002
- **작업 내용**
  - `eslint.config.mjs`에 `src/server/**` 대상으로 `no-restricted-syntax` 규칙을 추가한다. `query`나 `client.query` 호출의 첫 인자가 표현식이 들어간 `TemplateLiteral`이면 오류로 처리한다.
- **완료 조건**: `` query(`… ${x}`) ``를 쓴 임시 코드에서 `npm run lint`가 실패하고, 삭제하면 통과한다.

---

## G2. 인증 코어 (복잡도: High)

### T-006 인증 입력 스키마
- **Purpose**: 가입과 로그인 입력의 정규화와 검증 규칙을 클라이언트와 서버가 같이 쓰게 한다(FR-1, FR-2, FR-5).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: —
- **작업 내용**
  - `src/lib/auth/schema.ts`: `emailSchema`(trim, 소문자, 이메일 형식, 254자 이하), `passwordSchema`(8자 이상, UTF-8 72바이트 이하), `signupSchema`(패스워드 확인 일치), `loginSchema`를 만든다. 메시지는 한국어다.
  - `tests/unit/auth/schema.test.ts`를 먼저 작성한다.
- **완료 조건**: 단위 테스트가 통과한다. 경계값을 포함한다: `" A@B.com "`은 `a@b.com`, 7자는 실패, 8자는 성공, 한글 24자(72바이트)는 성공, 25자는 실패, 확인 불일치는 실패.

### T-007 패스워드 해시
- **Purpose**: 패스워드를 평문 없이 저장하고, 계정 존재 여부가 응답 시간으로 드러나지 않게 한다(FR-3, NFR-3).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-001
- **작업 내용**
  - `src/server/auth/password.ts`: `hashPassword`(argon2id, m=19456, t=2, p=1)와 `verifyPassword(hash, plain)`를 만든다. `verifyDummy(plain)`는 모듈을 불러올 때 만든 더미 해시로 검증해 비슷한 시간을 쓴다.
- **완료 조건**: 단위 테스트가 통과한다. 해시는 `$argon2id$`로 시작하고, 같은 입력의 해시 두 개가 서로 다르며(salt), 올바른 패스워드는 true, 틀린 패스워드는 false다. `verifyDummy`와 `verifyPassword`의 실행 시간 차이는 평균 30% 이내다.

### T-008 세션 생성·조회·삭제
- **Purpose**: 로그인 상태를 서버에서 관리하고, 토큰 원문이 DB에 남지 않게 한다(FR-7, FR-8, NFR-5, NFR-8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-002, T-004
- **작업 내용**
  - `src/server/auth/session.ts`
    - `createSession(userId)`: 32바이트 토큰을 만들고 `sha256` hex를 `sessions`에 INSERT한다(만료 7일). 같은 유저의 만료된 세션을 정리하고, `cookies().set`으로 쿠키를 설정한다(HttpOnly, SameSite=Lax, Path=/, Max-Age, Secure는 `SESSION_COOKIE_SECURE` 또는 production).
    - `getSessionUser(token)`: `sessions`, `users`, `boards`를 JOIN하고 `expires_at > now()`인 것만 → `{ userId, email, boardId } | null`
    - `deleteSession(token)`, `clearSessionCookie()`
  - 쿠키 이름 상수는 `SESSION_COOKIE = "kanban_session"`이다.
- **완료 조건**: `tests/db/session.test.ts`가 통과한다. `sessions.id`는 64자 hex이고 토큰 원문과 다르다. 만료 시각을 과거로 바꾸면 조회가 null이다. 삭제 뒤 조회도 null이다. 다시 로그인하면 이전 토큰과 다른 토큰이 나온다.

### T-009 로그인 시도 제한
- **Purpose**: 무차별 대입을 막는다(NFR-2, SC-9).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-002, T-004
- **작업 내용**
  - `src/server/auth/rateLimit.ts`: `isLoginBlocked(email, ip, now)`는 최근 15분 동안 이메일별 또는 IP별 실패가 10회 이상이면 true다. `recordLoginAttempt(email, ip, succeeded)`를 만든다. 시간은 인자로 주입해 테스트한다.
  - `getClientIp(headers)`: `x-forwarded-for`의 첫 값을 쓰고, 없으면 `"local"`이다.
- **완료 조건**: `tests/db/rateLimit.test.ts`가 통과한다. 9회 실패 후에는 false, 10회 실패 후에는 true(11번째 시도 차단)다. 16분 뒤에는 false다. 성공 기록은 세지 않는다. 다른 이메일이라도 같은 IP면 IP 기준으로 차단된다.

### T-010 DAL과 HTTP 헬퍼
- **Purpose**: 모든 서버 진입점이 같은 방식으로 세션을 확인하게 하고, 오류 응답과 CSRF 검사를 통일한다(FR-13, FR-21, NFR-1, NFR-4, NFR-6).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-008
- **작업 내용**
  - `src/server/auth/dal.ts`: `getSession = cache(async () => …)`은 쿠키를 읽어 `getSessionUser`를 호출하고 `{ userId, email, boardId } | null`을 돌려준다. `requireSession()`은 페이지용으로, 세션이 없으면 `redirect("/login")`한다.
  - `src/server/http/respond.ts`: `json(status, body)`로 `Cache-Control: no-store`를 붙인다. `unauthorized()`, `notFound()`, `invalid(fieldErrors)`, `serverError(err)`를 두고, `serverError`는 서버 로그에만 자세히 남기고 응답은 `{ error: "server" }`만 준다.
  - `src/server/http/sameOrigin.ts`: `assertSameOrigin(request)`는 `Origin`의 host가 `Host`나 `X-Forwarded-Host`와 다르면 403을 돌려준다.
- **완료 조건**: 단위 테스트가 통과한다. `assertSameOrigin`은 같은 origin, 다른 origin, Origin 없음(403), X-Forwarded-Host 경우를 확인한다. `serverError` 응답 본문에 `Error.message`가 포함되지 않는다.

---

## G3. 보드 데이터 계층 (복잡도: High)

### T-011 보드 조회와 행→도메인 변환
- **Purpose**: 세션 유저의 카드만 읽어 기존 `BoardState` 형태로 돌려준다(FR-12, FR-15, D6).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-004
- **작업 내용**
  - `src/server/board/rowsToBoard.ts`: 순수 함수로, `position`을 `order`로, `timestamptz`를 ISO 문자열로 바꾼다. 결과는 `boardStateSchema`를 통과해야 한다.
  - `src/server/board/queries.ts`의 `getBoard(boardId)`: `SELECT … FROM cards WHERE board_id = $1 ORDER BY status, position`
  - 모든 query 함수는 `boardId`를 첫 인자로 받는다. `userId`를 받는 함수는 만들지 않는다.
- **완료 조건**: `rowsToBoard` 단위 테스트(빈 보드, 컬럼 3개 정렬, `order` 매핑)가 통과한다. `tests/db/board.test.ts`에서 유저 A의 카드만 돌려주는지 확인한다.

### T-012 카드 생성·수정·삭제 쿼리
- **Purpose**: 쓰기와 삭제를 세션 유저의 보드로 한정하고, 확인과 변경을 한 SQL 문에서 처리한다(FR-16~19, FR-24).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-011
- **작업 내용**
  - `lockBoard(client, boardId)`: `SELECT id FROM boards WHERE id=$1 FOR UPDATE`
  - `addCard(boardId, { id, title, description })`: 보드를 잠근다 → TODO 컬럼 개수를 `position`으로 → `INSERT … ON CONFLICT (id) DO NOTHING RETURNING *` → 0행이면 `not_found`를 돌려준다(D3).
  - `updateCard(boardId, id, input)`: `UPDATE … SET title, description, updated_at=now() WHERE id=$1 AND board_id=$2 RETURNING *`
  - `deleteCard(boardId, id)`: 보드를 잠근다 → `DELETE … WHERE id=$1 AND board_id=$2 RETURNING status, position` → 같은 컬럼에서 뒤쪽 카드의 `position`을 1씩 당긴다.
  - 결과 타입은 `{ ok: true, value } | { ok: false, error: "not_found" }`이다.
- **완료 조건**: `tests/db/cards.test.ts`가 통과한다. 생성하면 TODO 맨 아래로 들어간다. 수정하면 `updated_at`이 바뀐다. 가운데 카드를 지우면 position이 0..n-1로 연속된다. 이미 있는 id로 생성하면 `not_found`다.

### T-013 카드 이동 쿼리
- **Purpose**: 컬럼 간·컬럼 안 이동을 하나의 트랜잭션으로 처리하고, 다른 유저의 카드가 섞일 수 없게 한다(FR-20, D1, D2, NFR-10).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-012
- **작업 내용**
  - `moveCard(boardId, id, toStatus, toIndex)`
    1. 보드를 잠근다.
    2. 자기 보드의 카드 전체를 조회한다(`WHERE board_id=$1`). 대상 id가 없으면 `not_found`다.
    3. `rowsToBoard`를 거친 뒤 기존 `src/lib/board/operations.ts`의 `moveCard` 순수 함수로 새 columns를 계산한다(`toIndex`는 clamp).
    4. 영향받은 컬럼(원래 컬럼과 대상 컬럼)의 id, status, position 배열을 `UPDATE cards c SET … FROM unnest($1::uuid[], $2::text[], $3::int[]) v(id,status,pos) WHERE c.id=v.id AND c.board_id=$4`로 반영한다.
    5. 갱신된 행 수가 배열 길이와 다르면 오류를 던져 롤백한다.
    6. 새 `BoardState`를 돌려준다.
- **완료 조건**: `tests/db/move.test.ts`가 통과한다. 같은 컬럼 안 재정렬, 다른 컬럼 중간 삽입, 빈 컬럼으로 이동, `toIndex` 초과 clamp를 확인한다. 이동 뒤 postgres MCP로 `SELECT status, position FROM cards WHERE board_id=… ORDER BY status, position`을 조회하면 컬럼마다 0..n-1로 연속이다.

### T-014 로컬 데이터 가져오기 쿼리
- **Purpose**: 기존 `localStorage` 보드를 서버 보드로 옮긴다(FR-25).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-012
- **작업 내용**
  - `importBoard(boardId, stored)`: `storedBoardSchema`로 검증한다(기존 `migrate` 포함) → 보드를 잠근다 → 카드가 이미 있으면 `conflict` → 카드마다 `crypto.randomUUID()`로 새 id를 발급해 `unnest`로 일괄 INSERT한다(columns 순서를 position으로). `createdAt`과 `updatedAt`은 원본을 유지한다.
- **완료 조건**: `tests/db/import.test.ts`가 통과한다. 컬럼별 카드 수, 순서, 제목이 원본과 같다. 원본 id는 쓰지 않는다. 카드가 있는 보드에 가져오면 `conflict`이고 기존 카드는 그대로다.

### T-015 격리·트랜잭션·동시성 통합 테스트
- **Purpose**: 요구사항 2의 핵심인 "자기 보드의 아이템만 접근"을 데이터 계층에서 증명한다(SC-5, SC-6, NFR-9, NFR-10).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-013, T-014
- **작업 내용**
  - `tests/db/isolation.test.ts`: 유저 A와 B가 각자 카드를 만든다. B의 `boardId`로 A의 카드에 `updateCard`, `deleteCard`, `moveCard`를 호출하면 전부 `not_found`이고, A의 행(`title`, `status`, `position`, `updated_at`)이 그대로다. `getBoard(B)`에는 A의 카드가 없다.
  - 트랜잭션: `moveCard` 4단계 이후에 강제로 오류를 내면(테스트 훅) 모든 position이 원래 값이다.
  - 동시성: 같은 보드에 서로 다른 `moveCard` 5건을 `Promise.all`로 보내도 UNIQUE 위반 없이 끝나고, 최종 position이 연속이다.
  - DB 제약: SQL로 직접 101자 제목, 공백 제목, `status='DOING'`을 INSERT하면 `23514`다. 같은 유저로 `boards`를 두 번 INSERT하면 `23505`다(FR-11).
- **완료 조건**: `npm run test:db`가 전부 통과한다.

---

## G4. 인증 흐름과 라우팅 (복잡도: Medium)

### T-016 가입·로그인·로그아웃 Server Actions
- **Purpose**: 이메일/패스워드 계정 흐름을 서버에서 구현한다(FR-1~8, NFR-2, NFR-3, NFR-8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-006, T-007, T-008, T-009
- **작업 내용**
  - `src/app/(auth)/actions.ts` (`"use server"`)
    - `signup(prev, formData)`: `signupSchema` → 해시 → `withTransaction`(users INSERT → boards INSERT) → `createSession` → `redirect("/")`. 23505이면 `fieldErrors.email = "이미 가입된 이메일입니다."`
    - `login(prev, formData)`: `isLoginBlocked`이면 제한 메시지 → 유저 조회 → 있으면 `verifyPassword`, 없으면 `verifyDummy` → `recordLoginAttempt` → 실패하면 통일된 메시지 → 성공하면 `createSession` → `redirect("/")`
    - `logout()`: `deleteSession` → 쿠키 삭제 → `redirect("/login")`
  - 반환 상태 타입은 `{ fieldErrors?, formError?, values?: { email } }`이다. 패스워드는 다시 돌려주지 않는다.
  - 로그를 남길 때 FormData를 출력하지 않는다.
- **완료 조건**: `tests/db/authActions.test.ts`(cookies와 redirect는 mock)가 통과한다. 가입하면 users 1건과 boards 1건이 생긴다. 중복 이메일(대문자 변형 포함)이면 오류다. 틀린 패스워드와 없는 이메일의 `formError`가 같은 문자열이다. 로그아웃하면 sessions 행이 삭제된다. postgres MCP로 `SELECT u.email, count(b.*) FROM users u LEFT JOIN boards b ON b.user_id=u.id GROUP BY u.email`을 조회하면 모든 유저가 보드 1개다(개발 DB에서 수동 가입 후).

### T-017 로그인·가입 화면
- **Purpose**: 접근성 기준을 지키는 인증 UI를 제공한다(US1, US2, US7, NFR-12, NFR-14).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-016
- **작업 내용**
  - `src/components/auth/PasswordField.tsx`: 표시/숨김 토글 버튼(`aria-pressed`, "패스워드 보기")
  - `LoginForm.tsx`, `SignupForm.tsx`: `useActionState`, `<label htmlFor>`, `aria-invalid`, `aria-describedby`, 폼 오류 `role="alert"`, `autocomplete`(email, current-password, new-password)를 쓴다. 제출 중에는 "처리 중…"을 표시하고, 실패하면 첫 오류 필드로 포커스를 옮긴다. 클라이언트에서도 `signupSchema`로 미리 검증한다.
  - `src/app/(auth)/layout.tsx`, `login/page.tsx`, `signup/page.tsx`: 서로 오가는 링크와 `<title>`을 둔다.
- **완료 조건**: 컴포넌트 테스트가 통과한다. 레이블로 입력을 찾을 수 있다. 오류가 나면 `aria-invalid="true"`이고 포커스가 이동한다. 토글하면 `type`이 `text`와 `password`로 바뀐다. `npm run dev`에서 `/signup`으로 가입하면 `/`로 이동한다.

### T-018 보드 페이지를 라우트 그룹으로 옮기고 헤더 추가
- **Purpose**: 보드를 서버에서 조회해 로그인한 유저에게만 보여주고, 로그아웃할 수 있게 한다(FR-9, FR-10, D4, NFR-9).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-010, T-011, T-016
- **작업 내용**
  - `src/app/page.tsx`를 `src/app/(board)/page.tsx`로 옮긴다: `requireSession()` → `getBoard(boardId)` → `<BoardProvider initialBoard={…}>`
  - `src/app/(board)/layout.tsx`와 `src/components/layout/AppHeader.tsx`: 유저 이메일과 `<form action={logout}>` 로그아웃 버튼을 둔다.
  - `src/app/(board)/loading.tsx`: 기존 `BoardSkeleton`을 재사용한다.
  - `BoardProvider`에 `initialBoard` prop을 임시로 받게 한다. 저장 연동은 T-023에서 한다.
- **완료 조건**: 로그인 상태에서 `/`에 가입한 이메일과 보드가 보인다. 로그아웃하면 `/login`으로 이동한다. `npm run build`가 통과한다.

### T-019 Proxy 낙관적 리다이렉트
- **Purpose**: 로그인하지 않은 방문자를 로그인 화면으로, 로그인한 유저를 보드로 보낸다(FR-9, US6).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-018
- **작업 내용**
  - 먼저 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`에서 파일 위치(`src/` 사용 시)와 `matcher`를 확인한다.
  - `proxy.ts`: 쿠키 `kanban_session`이 있는지만 본다(DB 조회 안 함). `/`는 쿠키가 없으면 `/login`, `/login`과 `/signup`은 쿠키가 있으면 `/`로 보낸다. matcher에서 `/api`, `_next/static`, `_next/image`, `favicon.ico`는 뺀다.
  - 쿠키는 있지만 세션이 만료된 경우는 `requireSession()`이 `/login`으로 보낸다. 이때 리다이렉트가 반복되지 않도록 `/login`에서 유효하지 않은 쿠키를 지운다.
- **완료 조건**: 쿠키가 없을 때 `/`에 들어가면 `/login`으로 간다. 로그인한 뒤 `/login`에 들어가면 `/`로 간다. 쿠키 값을 위조하면 `/login`에 머물고 무한 리다이렉트가 없다(E2E T-029에서 자동화).

---

## G5. 보드 API (복잡도: Medium)

### T-020 보드 조회와 카드 생성 API
- **Purpose**: 클라이언트가 세션 유저의 보드를 읽고 카드를 추가할 수 있게 한다(FR-15, FR-16, FR-21).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-010, T-012
- **작업 내용**
  - `src/app/api/board/route.ts`의 `GET`: `getSession()`이 없으면 401 → `getBoard`
  - `src/app/api/board/cards/route.ts`의 `POST`: `assertSameOrigin` → 세션 → body를 `cardInputSchema`와 `id: z.uuid()`로 검증 → `addCard` → 201, 또는 400/404
  - 모든 응답은 `respond.ts`를 거친다.
- **완료 조건**: Route Handler 단위 테스트(`tests/db/api.board.test.ts`, `Request`를 직접 만들어 호출)가 통과한다. 세션이 없으면 401, 다른 Origin이면 403, 빈 제목이면 400, 정상이면 201이다.

### T-021 카드 수정·삭제·이동·가져오기 API
- **Purpose**: 나머지 쓰기와 삭제를 세션 유저의 보드로 한정한 API로 제공한다(FR-16~21, FR-25).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-013, T-014, T-020
- **작업 내용**
  - `cards/[id]/route.ts`: `PATCH`(수정 → 200 Card), `DELETE`(→ 204). 동적 파라미터는 Next 16 규칙대로 `await params`로 받는다(문서 확인).
  - `cards/[id]/move/route.ts`: `POST { toStatus, toIndex }` → 200 `BoardState`
  - `import/route.ts`: `POST StoredBoard` → 200 `BoardState`, 카드가 있으면 409
  - `[id]`가 UUID 형식이 아니면 400이 아니라 **404**로 응답한다. 존재 여부와 형식을 구분하지 않는다.
- **완료 조건**: API 테스트가 통과한다. B 세션으로 A의 카드에 PATCH, DELETE, move를 보내면 전부 404이고 본문이 `{ error: "not_found" }`로 같다. 정상 경로는 200/204다. 오류 응답 본문에 `SELECT`, `cards`, `at ` 같은 SQL이나 스택 문자열이 없다.

---

## G6. 클라이언트 연동 (복잡도: High)

### T-022 비동기 저장소 인터페이스와 구현체
- **Purpose**: `BoardProvider`가 서버 API를 쓰도록 저장소 경계를 비동기로 바꾼다(plan §5.3, C3).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-021
- **작업 내용**
  - `src/lib/storage/boardRepository.ts`: `RepoError`, `RepoResult`, 비동기 `BoardRepository`(addCard, updateCard, deleteCard, moveCard, importBoard)
  - `apiBoardRepository.ts`: `fetch`(`credentials: "same-origin"`)로 구현하고, 상태 코드를 `RepoError`로 바꾼다(401→unauthorized, 404→not_found, 400→invalid, 409→conflict, 5xx→server, 예외→network).
  - `memoryBoardRepository.ts`: 테스트용이다. 실패를 주입할 수 있다(`failNext(error)`).
  - `localStorageBoardRepository`는 `load()`만 남긴 `localBoardSource`로 역할을 줄이고, 기존 테스트를 맞게 고친다.
- **완료 조건**: `apiBoardRepository` 단위 테스트(`fetch` mock, 상태 코드 6종)가 통과한다. `npm run typecheck`가 통과한다.

### T-023 BoardProvider 비동기 커밋 큐
- **Purpose**: 낙관적 업데이트를 유지하면서, 서버 저장에 실패하면 화면을 마지막으로 확정된 상태로 되돌린다(FR-22, FR-23, FR-21, D5).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-018, T-022
- **작업 내용**
  - 초기 상태는 `initialBoard`로 하고, `isHydrated`는 true로 시작한다. `repository.load()`와 `storage` 이벤트 구독은 제거한다.
  - `commit(action)`은 즉시 리듀서를 적용하고 `Promise<boolean>`을 돌려준다. 액션을 저장소 호출로 바꾸고(ADD, UPDATE, DELETE, MOVE), Promise 체인 큐로 순서대로 보낸다.
  - 성공하면 `lastSaved`를 갱신한다. MOVE는 서버가 준 `BoardState`로 `HYDRATE`해 조정한다(단, 대기 중인 요청이 없을 때만).
  - 실패하면 대기 중인 요청을 모두 버리고 `RESTORE(lastSaved)`와 토스트를 띄운다. `unauthorized`이면 "로그인이 만료되었습니다." 토스트 뒤에 `router.replace("/login")`한다.
  - 호출하는 쪽(`useBoard`, `useBoardDnd`, 다이얼로그)이 `commit` 반환값을 쓰던 곳을 비동기에 맞게 고친다. 다이얼로그는 저장 실패 시 닫지 않는다.
- **완료 조건**: `BoardProvider` 테스트가 통과한다(memory repo). 성공 경로, 단일 실패 롤백, **연속 두 커밋 중 첫 번째가 실패하면 두 변경 모두 롤백**, 401이면 `/login`으로 이동한다. 기존 `Board.test.tsx`와 `dialogs.test.tsx`도 통과한다. 드래그 중 저장이 지연돼도(mock 300ms) 카드가 제자리로 튀지 않는다.

### T-024 로컬 데이터 가져오기 안내
- **Purpose**: 로그인 전에 쓰던 카드를 계정 보드로 옮길 수 있게 한다(FR-25, US8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-023
- **작업 내용**
  - `src/components/board/ImportPrompt.tsx`: 기존 `ConfirmDialog`를 재사용한다. "이 브라우저에 저장된 카드 N개를 내 보드로 가져올까요?"
  - `initialBoard`가 비어 있고 `localBoardSource.load()`가 ok이며 `sessionStorage`에 거절 표시가 없을 때 연다.
  - 확인하면 `importBoard` → 성공 시 `HYDRATE` → 원본을 `kanban-app:board:imported-<ts>`로 옮긴다. 취소하면 `sessionStorage`에 표시한다.
- **완료 조건**: 컴포넌트 테스트가 통과한다. 조건이 맞을 때만 안내가 뜬다. 확인하면 카드가 표시되고 원본 키가 옮겨진다. 취소하면 새로고침(같은 세션)해도 다시 뜨지 않는다. 가져오기에 실패하면 토스트가 뜨고 원본은 유지된다.

---

## G7. 보안과 성능 점검 (복잡도: Medium)

### T-025 보안 설정 정리
- **Purpose**: 비밀 정보 노출 경로를 막고, 렌더링 방식 변화에 맞게 보안 설정을 확인한다(NFR-5, NFR-7, SC-9, plan §10.4).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-019, T-023
- **작업 내용**
  - `next.config.ts`의 CSP 주석에서 "정적 렌더링" 전제를 고친다. `form-action 'self'`로 Server Action 폼이 동작하는지 확인한다.
  - `src/server/**` 모든 파일의 첫 줄이 `import "server-only"`인지 확인한다.
  - `npm run build` 뒤 `.next/static`에서 `DATABASE_URL`, `postgres://`, `argon2`, `password_hash` 문자열을 검색한다.
  - `git log -p`와 작업 트리에서 접속 문자열이나 비밀번호 패턴을 검색한다.
- **완료 조건**: 두 검색 결과가 모두 0건이다. 기존 `security.spec.ts`가 통과한다(T-027 이후 재확인).

### T-026 성능 측정과 실행 계획 확인
- **Purpose**: 서버 저장으로 바뀐 뒤에도 응답 시간 목표를 지키는지 측정한다(NFR-9, NFR-10, NFR-11).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-023
- **작업 내용**
  - 개발 DB에 테스트 유저로 카드 100개를 만든다(API 시드 스크립트 또는 수동).
  - **postgres MCP** `explain_query`로 `SELECT … FROM cards WHERE board_id=$1 ORDER BY status, position`의 실행 계획을 확인한다(가상 인덱스 없이). 데이터가 적어 Seq Scan이면 `SET enable_seqscan` 없이 행 수를 늘려 재확인하거나, 인덱스가 존재하는 것만 기록한다.
  - **postgres MCP** `analyze_db_health()` 결과를 기록한다.
- **완료 조건**: 실행 계획, health 결과, 측정값을 이 작업의 구현 메모에 남긴다. 자동 측정은 T-031에서 한다.

---

## G8. E2E 테스트와 마무리 (복잡도: High)

### T-027 E2E 인프라: 테스트 DB, 인증 fixture, API 시드
- **Purpose**: 모든 E2E를 로그인한 상태에서, 테스트끼리 격리된 데이터로 돌릴 수 있게 한다(C4, plan §9.3).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-023
- **작업 내용**
  - `playwright.config.ts`: `globalSetup`(`db-test-setup` 실행), `webServer.env`(`DATABASE_URL=TEST_DATABASE_URL`, `SESSION_COOKIE_SECURE=false`)를 설정한다.
  - `tests/e2e/fixtures.ts`: `test.extend`로 `user` fixture를 둔다(고유 이메일로 `/signup` 가입 → `storageState`). `seedCards(request, cards)`로 API 시드를 한다.
  - `helpers.ts`의 `openWith`와 `readStored`를 API 기반으로 바꾼다(`readBoard` = `GET /api/board`).
  - `package.json`의 `test:e2e`에 `db:test:setup`을 앞세운다.
- **완료 조건**: `smoke.spec.ts`가 로그인 fixture로 통과한다(chromium).

### T-028 기존 E2E를 로그인 기반으로 전환
- **Purpose**: 기존 기능이 로그인 뒤에도 똑같이 동작하는지 회귀를 확인한다(G4, SC-10).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-027
- **작업 내용**
  - `board`, `dnd`, `a11y`, `mobile`, `security`, `performance`, `smoke` spec이 fixture를 쓰도록 바꾼다. `localStorage` 주입을 API 시드로 교체한다.
  - `persistence.spec.ts`: 새로고침 뒤 유지되는지, **새 브라우저 컨텍스트에서 다시 로그인**해도 같은 보드인지 확인한다(SC-7). 저장 실패 롤백은 `page.route`로 `/api/board/**`에 500을 주입해 확인한다.
- **완료 조건**: 기존 spec이 전부 통과한다(chromium, edge, mobile 프로젝트).

### T-029 인증 E2E
- **Purpose**: 가입, 로그인, 로그아웃, 시도 제한, 리다이렉트를 브라우저에서 확인한다(SC-1~4, SC-9, US6, US7).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-027
- **작업 내용** (`tests/e2e/auth.spec.ts`)
  - 가입하면 빈 보드와 헤더에 이메일이 보인다(SC-1).
  - `" User@Test.local "`로 다시 가입하면 중복 오류가 난다(SC-2).
  - 틀린 패스워드와 없는 이메일의 오류 문구가 같다(SC-3).
  - 로그아웃하면 `/login`으로 가고, `/`에 들어가면 `/login`으로 간다. `request.get("/api/board")`는 401이다(SC-4).
  - 로그인에 10번 실패하면 11번째에 제한 메시지가 뜬다(SC-9).
  - 쿠키를 위조해도 무한 리다이렉트 없이 `/login`이 표시된다(T-019).
- **완료 조건**: `auth.spec.ts`가 통과한다.

### T-030 권한 격리·보안 E2E
- **Purpose**: 요구사항 2를 실제 HTTP 경계에서 증명한다(SC-5, SC-6, NFR-4, NFR-6).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-027
- **작업 내용**
  - `tests/e2e/authz.spec.ts`: 브라우저 컨텍스트 A와 B를 만들고 각각 카드를 만든다. B의 `request`로 A의 카드 id에 `PATCH`, `DELETE`, `POST …/move`를 보내면 전부 404이고, A의 화면을 새로고침해도 변화가 없다. B의 `GET /api/board`에 A의 카드 id가 없다. `POST /api/board/cards`에 `boardId`나 `userId` 필드를 끼워 넣어도 B의 보드에만 생성된다.
  - `security.spec.ts` 추가: `Origin: https://evil.example`로 보낸 POST는 403이다. 오류 응답 본문에 SQL이나 스택 흔적이 없다. 세션 쿠키가 `HttpOnly`, `SameSite=Lax`다.
- **완료 조건**: 두 spec이 통과한다. 이어서 **postgres MCP**로 `SELECT b.user_id, count(c.*) FROM boards b LEFT JOIN cards c ON c.board_id=b.id GROUP BY b.user_id`를 조회해 개발 DB에서 수동으로 재현한 결과와 대조한다.

### T-031 가져오기·접근성·성능 E2E
- **Purpose**: 나머지 성공 기준을 자동으로 확인한다(FR-25, NFR-9, NFR-10, NFR-13).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-024, T-027
- **작업 내용**
  - `import.spec.ts`: 로그인 전에 `localStorage`에 기존 형식 데이터를 주입 → 가입 → 가져오기를 확인한다 → 카드 수, 순서, 상태가 같다. 새 컨텍스트로 로그인해도 유지된다.
  - `a11y.spec.ts`: `/login`, `/signup`, 오류가 표시된 상태에서 axe 위반이 0건이다.
  - `performance.spec.ts`: 카드 100개를 시드한 뒤 로그인부터 보드 첫 표시까지 1초 이내다. 이동을 20회 해서 `waitForResponse`로 측정한 p95가 150ms 이하다(로컬 기준, CI는 완화된 임계값).
- **완료 조건**: 세 spec이 통과한다.

### T-032 최종 검증과 문서
- **Purpose**: 전체 품질 게이트와 MCP 최종 검증을 통과하고, 실행 방법을 문서로 남긴다(SC-8, SC-11).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-025, T-026, T-028, T-029, T-030, T-031
- **작업 내용**
  - `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run test:e2e`를 실행한다.
  - **postgres MCP 최종 점검**(`mydb`)
    - 유저마다 보드가 1개다: `SELECT user_id, count(*) FROM boards GROUP BY user_id HAVING count(*) <> 1` → 0행
    - 해시만 저장된다: `SELECT count(*) FROM users WHERE password_hash NOT LIKE '$argon2id$%'` → 0 (SC-8)
    - 세션 토큰 원문이 없다: `SELECT count(*) FROM sessions WHERE id !~ '^[0-9a-f]{64}$'` → 0
    - position이 연속이다: 컬럼별 `max(position)+1 = count(*)`
  - `README.md`에 로컬 실행 순서(plan §10.3), 환경 변수, 테스트 명령, MCP 검증 방법을 적는다.
  - 이 문서 끝에 "구현 메모"와 요구사항 추적표의 상태를 갱신한다.
- **완료 조건**: 모든 명령과 MCP 점검이 통과하고, 결과가 구현 메모에 기록되어 있다.

---

## 요구사항 추적표

| 명세 항목 | 작업 |
| --- | --- |
| FR-1~2 이메일·패스워드 규칙 | T-006, T-016, T-017 |
| FR-3 패스워드 해시 | T-007, T-032 |
| FR-4 가입 시 보드 생성(트랜잭션) | T-016 |
| FR-5 중복 이메일 | T-003, T-016, T-029 |
| FR-6 통일된 로그인 오류 | T-016, T-029 |
| FR-7~8 세션, 로그아웃 | T-008, T-016, T-018 |
| FR-9 리다이렉트 | T-018, T-019, T-029 |
| FR-10 헤더(이메일, 로그아웃) | T-018 |
| FR-11 유저당 보드 1개 | T-003, T-015, T-032 |
| FR-12 고정 3컬럼 | T-011 |
| FR-13 세션 기준 보드 | T-010, T-011, T-020 |
| FR-14 카드 모델 | T-003, T-011 |
| FR-15~19 읽기·쓰기·삭제 소유권, 404 | T-011~T-013, T-015, T-020, T-021, T-030 |
| FR-20 다중 변경 트랜잭션 | T-013, T-015 |
| FR-21 401 처리 | T-010, T-020, T-023, T-029 |
| FR-22~23 롤백, 낙관적 업데이트 | T-023, T-028 |
| FR-24 zod 공용 검증 | T-006, T-020, T-021 |
| FR-25 로컬 데이터 가져오기 | T-014, T-021, T-024, T-031 |
| NFR-1 서버 권한 판단 | T-010, T-030 |
| NFR-2 시도 제한 | T-009, T-016, T-029 |
| NFR-3 시간 균일화 | T-007, T-016 |
| NFR-4 CSRF | T-010, T-016, T-030 |
| NFR-5 비밀 비노출 | T-001, T-008, T-025 |
| NFR-6 파라미터 바인딩 | T-005, T-012, T-021 |
| NFR-7 CSP·XSS | T-025, T-028 |
| NFR-8 세션 재발급 | T-008 |
| NFR-9~11 성능, 인덱스 | T-003, T-026, T-031 |
| NFR-12~14 접근성, 사용성 | T-017, T-031 |
| SC-1~4 | T-016, T-029 |
| SC-5~6 격리, 부분 반영 없음 | T-015, T-021, T-030 |
| SC-7 기기 간 동일 보드 | T-028, T-031 |
| SC-8 해시만 저장 | T-008, T-032 |
| SC-9 시도 제한 | T-009, T-029 |
| SC-10~11 회귀, 품질 게이트 | T-028, T-032 |
| 요청 2: postgres MCP로 쿼리 실행 | T-003, T-004, T-013, T-016, T-026, T-030, T-032 |

---

## 구현 메모 (2026-09-29, `/sdd:implement --all`)

### 최종 검증 결과 (T-032)

| 명령 | 결과 |
| --- | --- |
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm test` | 147개 통과 |
| `npm run test:coverage` | `src/lib` 라인 98.19% (기준 90%) |
| `npm run test:db` | 54개 통과 (격리, 트랜잭션, 동시성, DB 제약, API 포함) |
| `npm run test:e2e` | 105개 통과 (chromium, edge, mobile) |
| `npm run build` | 통과. `/`는 동적, `/login`·`/signup`은 정적 |

측정값(로컬): 카드 100장 보드 첫 표시 176~406ms (NFR-9 기준 1초), 이동 API p50 12ms · p95 16~17ms (NFR-10 기준 150ms), 카드 600장 첫 표시 592ms.

### postgres MCP 검증 기록 (`mydb`)

- T-003: `list_objects(public)` → 6개 테이블. `pg_constraint` 조회로 `cards_board_status_position_key`가 `deferrable=true, deferred=true`인 것, CHECK·FK·UNIQUE를 확인했다.
- T-004: `pg_database` 조회로 `mydb_test`가 생성된 것을 확인했다.
- T-016·T-030·T-032: 개발 서버에서 브라우저로 alice, bob을 가입시키고 alice 보드에 카드 100장을 만든 뒤 확인했다.
  - 유저별 보드 1개, 카드 수(alice 100, bob 1), 해시 접두사 `$argon2id$`
  - 최종 점검 쿼리 5종이 모두 0: 보드 수 이상, argon2id가 아닌 해시, 원문 세션 토큰, position 불연속 컬럼, bob의 탈취 시도로 바뀐 제목
  - bob 세션으로 alice 카드에 PATCH·move·DELETE를 보내면 모두 `404 {"error":"not_found"}`였고, alice 카드는 그대로였다.
  - 이동 결과: `SELECT status, position, title ...`이 API로 옮긴 순서와 같았다(DONE 맨 위 "Alice 작업 33" 등).
- T-026: `explain_query`의 보드 조회는 전체 101행이라 Seq Scan + Sort였다(plan이 허용한 경우). 인덱스는 T-003에서 확인했다. 읽기 전용 모드에서는 `EXPLAIN ANALYZE`가 거부된다. `analyze_db_health`: 잘못되거나 중복되거나 부푼 인덱스 없음, 잘못된 제약 없음, 연결 정상. 새 인덱스라 사용 횟수가 적다는 안내만 있었다.

### 계획과 달라진 점

- **세션 만료 쿠키 정리**: Server Component 렌더 중에는 쿠키를 바꿀 수 없다(Next 16 문서). 그래서 `requireSession()`은 쿠키가 남아 있으면 `/api/auth/session-expired`(쿠키 삭제 후 `/login`으로 이동)로 보낸다. `/login`에서 지우려던 계획(T-019)을 이렇게 바꿨다.
- **로그아웃 후 이동**: `window.location.replace("/login")`을 쓴다. `BoardProvider`의 `onUnauthorized` prop으로 바꿀 수 있어 테스트에서는 mock을 넣는다.
- **다이얼로그 저장 실패**: T-023의 "저장 실패 시 다이얼로그를 닫지 않는다" 대신, 다른 변경과 같이 낙관적으로 바로 닫고 실패하면 되돌리면서 토스트를 띄운다. 모든 변경의 동작을 하나로 맞췄다.
- **`(auth)/layout.tsx`는 만들지 않았다**: 로그인·가입 화면의 레이아웃은 `AuthForm` 하나에 있다. 서버 컴포넌트가 zod 스키마를 클라이언트로 넘길 수 없어서 `LoginForm`, `SignupForm` 클라이언트 래퍼를 두었다.
- **`ConfirmDialog` 일반화**: 삭제 확인과 가져오기 확인에 같이 쓰도록 `heading`, `message`, `confirmLabel`, `destructive` props로 바꿨다.
- **가져오기 형식이 틀린 경우**: `not_found`가 아니라 `invalid`(400)로 답한다.
- **헤더 높이 반영**: 컬럼 높이가 `100dvh-7rem`으로 화면을 꽉 채우게 되어 있었다. 헤더(3rem + 테두리 1px)를 넣자 페이지가 세로로 넘쳐 드래그 중 자동 스크롤로 드롭 위치가 어긋났다. 그래서 헤더를 `h-12`로 고정하고 컬럼·스켈레톤 높이를 `100dvh-10rem-1px`로 고쳤다.
- **E2E 포트와 DB**: E2E는 3100 포트에서 `TEST_DATABASE_URL`로 돈다. 개발 서버를 실수로 재사용하지 않도록 `reuseExistingServer: false`로 두었다.
- **`.playwright-mcp/`**: 브라우저 자동화 도구 산출물(스크린샷, 로그)이라 `.gitignore`에 넣었다.

### 남은 과제

- nonce 기반 CSP 전환 (plan §10.4)
- 운영 배포 시 앱 전용 최소 권한 DB 역할 분리 (plan §8)
- `favicon.ico`가 없어 404가 난다(이번 작업 이전부터 있던 문제)
- 개발 DB `mydb`에 수동 검증용 계정 `alice@demo.local`, `bob@demo.local`과 카드가 남아 있다. MCP가 읽기 전용이라 필요하면 직접 지워야 한다.
