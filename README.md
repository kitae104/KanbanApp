# KanbanApp
칸반 보드 만들기(SDD)

할 일 · 진행 중 · 완료 3개 컬럼으로 작업을 관리하는 칸반 보드입니다. 카드를 Drag & Drop으로 옮기면 놓은 컬럼에 따라 상태가 바뀝니다. 마우스, 터치, 키보드로 모두 옮길 수 있습니다.

이메일과 패스워드로 가입·로그인하면 유저마다 보드가 하나씩 생깁니다. 보드는 PostgreSQL에 저장되므로 어느 브라우저나 기기에서 로그인해도 같은 보드가 보입니다. 유저는 자기 보드의 카드만 읽고, 쓰고, 지울 수 있습니다.

- 명세·계획·작업 목록
  - 보드 UI: [`docs/frontend-setup/`](docs/frontend-setup/)
  - 로그인·DB 연동: [`docs/db-integration/`](docs/db-integration/)
- 기술 스택: Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS 4 · dnd-kit · zod · PostgreSQL 18 (`pg`) · argon2id (`@node-rs/argon2`)

## 요구 사항

- Node.js 22.18 이상 (`.mts` 스크립트를 타입 제거로 바로 실행하고, `process.loadEnvFile`을 씁니다)
- npm
- PostgreSQL (개발 DB `mydb`, 테스트 DB `mydb_test`)

## 설정

1. `.env.example`을 참고해 프로젝트 루트에 `.env.local`을 만듭니다. 이 파일은 git에 올라가지 않습니다.

   | 이름 | 예시 | 용도 |
   | --- | --- | --- |
   | `DATABASE_URL` | `postgres://postgres:<비밀번호>@localhost:5432/mydb` | 앱과 마이그레이션 |
   | `TEST_DATABASE_URL` | `postgres://postgres:<비밀번호>@localhost:5432/mydb_test` | DB 통합 테스트와 E2E |
   | `SESSION_COOKIE_SECURE` | (비움) | 비우면 프로덕션에서만 Secure 쿠키. 로컬 http에서 프로덕션 빌드를 쓸 때 `false` |

2. 스키마를 적용합니다. 여러 번 실행해도 안전합니다.

   ```bash
   npm install
   npm run db:migrate   # db/migrations/*.sql 을 DATABASE_URL에 적용
   npm run db:status    # 적용 여부 확인
   ```

## 실행

```bash
npm run dev          # http://localhost:3000 → /login 으로 이동, /signup 에서 가입
```

프로덕션 빌드로 실행하려면:

```bash
npm run build
npm run start
```

## 테스트와 품질 검사

| 명령 | 내용 |
| --- | --- |
| `npm run lint` | ESLint (`react/no-danger`, SQL 문자열 보간 금지 포함) |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run test` | 단위·컴포넌트 테스트 (Vitest + jsdom) |
| `npm run test:coverage` | 위 테스트 + `src/lib` 커버리지(라인 90% 미만이면 실패) |
| `npm run test:db` | DB 통합 테스트. 실제 `mydb_test`에서 쿼리, 유저 간 격리, 트랜잭션, 동시성, API를 검사 |
| `npm run test:e2e` | E2E 테스트 (테스트 DB를 비운 뒤 프로덕션 빌드를 3100 포트로 띄워 실행) |
| `npm run db:test:setup` | 테스트 DB를 만들고(없으면) 마이그레이션 후 데이터를 비움 |

테스트 DB는 개발 DB와 분리되어 있습니다. `TEST_DATABASE_URL`이 `DATABASE_URL`과 같은 DB를 가리키면 설정 스크립트가 실행을 거부합니다.

E2E를 처음 실행하기 전에 브라우저를 설치합니다.

```bash
npx playwright install chromium
```

지원 브라우저는 Chrome과 Edge입니다. Playwright 프로젝트는 `chromium`, `edge`(PC에 설치된 Microsoft Edge 사용), `mobile`(Pixel 7)입니다. 특정 브라우저만 돌리려면 `npx playwright test --project=chromium`처럼 지정합니다. E2E는 테스트마다 새 계정으로 가입해서 로그인한 상태로 실행합니다.

## postgres MCP로 DB 확인하기

개발 중 DB 확인 쿼리는 postgres MCP로 실행합니다. 지금 설정된 MCP는 **읽기 전용**이어서 `CREATE`·`INSERT` 같은 변경은 거부됩니다. 그래서 스키마 변경은 `npm run db:migrate`로 하고, 결과는 MCP로 확인합니다.

자주 쓰는 확인 쿼리(`mydb` 대상):

```sql
-- 유저마다 보드가 정확히 1개인지 (0행이어야 함)
SELECT user_id, count(*) FROM boards GROUP BY user_id HAVING count(*) <> 1;

-- 패스워드가 argon2id 해시로만 저장되는지 (0이어야 함)
SELECT count(*) FROM users WHERE password_hash NOT LIKE '$argon2id$%';

-- 세션 토큰 원문이 없는지: id는 sha256 hex만 (0이어야 함)
SELECT count(*) FROM sessions WHERE id !~ '^[0-9a-f]{64}$';

-- 컬럼마다 position이 0..n-1로 연속인지 (0행이어야 함)
SELECT board_id, status FROM cards GROUP BY board_id, status
HAVING min(position) <> 0 OR max(position) + 1 <> count(*);
```

## 데이터 저장과 보안

- 테이블: `users`, `sessions`, `boards`(유저당 1개, UNIQUE), `cards`, `login_attempts`, `schema_migrations`. 제목 길이, 상태 값, 컬럼 안 순서 중복은 DB 제약으로도 막습니다.
- 로그인 상태는 서버 세션입니다. 쿠키(`kanban_session`, HttpOnly, SameSite=Lax)에는 무작위 토큰을 넣고, DB에는 그 해시만 저장합니다. 로그아웃하면 서버에서 바로 무효화됩니다.
- 모든 보드 API는 세션에서 찾은 보드만 다룹니다. 다른 유저의 카드 ID로 요청하면 없는 카드와 똑같이 `404`를 돌려줍니다.
- 카드를 옮기면 화면에 먼저 반영하고 서버에 순서대로 저장합니다. 저장에 실패하면 서버에 확정된 마지막 상태로 되돌리고 알림을 보여줍니다. 세션이 만료됐으면 로그인 화면으로 보냅니다.
- 같은 이메일이나 IP에서 15분 동안 로그인에 10번 실패하면 잠시 로그인을 막습니다.
- 로그인 전에 이 브라우저 `localStorage`(`kanban-app:board`)에 쓰던 카드가 있고 서버 보드가 비어 있으면, 로그인 후 내 보드로 가져올지 묻습니다.

## 키보드 조작

1. `Tab`으로 카드에 포커스합니다(헤더의 로그아웃 버튼 다음).
2. `Space` 또는 `Enter`로 카드를 집습니다.
3. 방향키로 옮깁니다(좌우: 컬럼, 상하: 순서).
4. `Space` 또는 `Enter`로 놓습니다. `Esc`로 취소합니다.

스크린리더에는 집기·이동·놓기·취소가 한국어로 안내됩니다.

## 범위 밖

이메일 인증, 패스워드 재설정, 소셜 로그인, 보드 공유, 회원 탈퇴, 실시간 동기화(다른 기기의 변경은 새로고침하면 보입니다), 운영 배포는 이번 범위에 넣지 않았습니다.
