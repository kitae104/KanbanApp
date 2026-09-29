# KanbanApp
칸반 보드 만들기(SDD)

할 일 · 진행 중 · 완료 3개 컬럼으로 작업을 관리하는 칸반 보드입니다. 카드를 Drag & Drop으로 옮기면 놓은 컬럼에 따라 상태가 바뀝니다. 마우스, 터치, 키보드로 모두 옮길 수 있습니다.

- 명세·계획·작업 목록: [`docs/frontend-setup/`](docs/frontend-setup/) (`spec.md`, `plan.md`, `tasks.md`)
- 기술 스택: Next.js 16 (App Router) · React 19 · TypeScript 5.9 · Tailwind CSS 4 · dnd-kit · zod

## 요구 사항

- Node.js 20.9 이상 (개발 환경: 22.x)
- npm

## 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

프로덕션 빌드로 실행하려면:

```bash
npm run build
npm run start
```

## 테스트와 품질 검사

| 명령 | 내용 |
| --- | --- |
| `npm run lint` | ESLint (`react/no-danger` 포함) |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm run test` | 단위·컴포넌트 테스트 (Vitest + jsdom) |
| `npm run test:coverage` | 위 테스트 + `src/lib` 커버리지(라인 90% 미만이면 실패) |
| `npm run test:e2e` | E2E 테스트 (Playwright, 프로덕션 빌드를 띄워서 실행) |

E2E를 처음 실행하기 전에 브라우저를 설치합니다.

```bash
npx playwright install chromium
```

지원 브라우저는 Chrome과 Edge입니다. Playwright 프로젝트는 `chromium`, `edge`(PC에 설치된 Microsoft Edge 사용), `mobile`(Pixel 7)입니다. 특정 브라우저만 돌리려면 `npx playwright test --project=chromium`처럼 지정합니다.

## 데이터 저장

- 서버·DB 없이 브라우저 `localStorage`의 `kanban-app:board` 키에 저장합니다. 다른 브라우저나 기기와는 공유되지 않습니다.
- 저장 형식은 `{ version, savedAt, board }`이며 불러올 때 zod로 검증합니다. 읽을 수 없는 데이터는 `kanban-app:board:corrupt-<시각>` 키로 백업하고 빈 보드로 시작합니다.
- 저장에 실패하면(용량 초과 등) 마지막으로 저장된 상태로 되돌리고 알림을 보여줍니다.
- 같은 브라우저의 다른 탭에서 바꾼 내용은 자동으로 반영됩니다.

## 키보드 조작

1. `Tab`으로 카드에 포커스합니다.
2. `Space` 또는 `Enter`로 카드를 집습니다.
3. 방향키로 옮깁니다(좌우: 컬럼, 상하: 순서).
4. `Space` 또는 `Enter`로 놓습니다. `Esc`로 취소합니다.

스크린리더에는 집기·이동·놓기·취소가 한국어로 안내됩니다.

## 범위 밖

이번 작업에서는 백엔드(API·DB), 로그인, 배포를 구현하지 않았습니다. 저장소는 `BoardRepository` 인터페이스로 분리되어 있어 나중에 API 구현체로 바꿀 수 있습니다.
