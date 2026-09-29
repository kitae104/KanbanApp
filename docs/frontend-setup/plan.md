# Kanban App — 기술 계획 (Plan)

> 기준 명세: [`docs/frontend-setup/spec.md`](./spec.md)
> 작성일: 2026-09-29 · 브랜치: `frontend-setup`

## 1. Original Tech Stack Request (원문)

> frontend는 Nextjs, dnd-kit, Tailwindcss를 사용하고 안정적인 버전을 선택하도록 한다. 상태 관리는 localStorage를 활용한다. backend와 배포는 이번 작업에서는 구현하지 않는다.

### 요청 해석

| 요청 | 계획에 반영한 내용 |
| --- | --- |
| Next.js | App Router 기반 Next.js 16.3.x. 페이지는 `/` 하나다. |
| dnd-kit | 정식 버전(1.0 이상)인 `@dnd-kit/core` 6 + `@dnd-kit/sortable` 10을 쓴다. 0.x 버전인 `@dnd-kit/react`는 쓰지 않는다. |
| Tailwind CSS | Tailwind CSS v4.3.x를 `@tailwindcss/postcss`로 연결한다. |
| 안정적인 버전 | `latest` 태그의 정식 릴리스만 쓴다. 나온 지 얼마 안 된 메이저 버전(TypeScript 7, Vitest 5, ESLint 10 등)은 쓰지 않고, 생태계 호환성이 검증된 바로 앞 메이저 버전의 최신 패치를 쓴다(§11 참고). |
| localStorage 상태 관리 | 앱 상태는 `useReducer` + Context로 관리한다. 영속 저장소로 `localStorage`를 쓴다(명세 A3 확정). |
| backend·배포 제외 | API 서버, DB, 인증, 호스팅 배포는 만들지 않는다. 로컬에서 `next build` / `next start`가 되는지까지만 확인한다. |

## 2. Technology Stack (기술 스택)

| 영역 | 기술 | 버전 | 선택 이유 |
| --- | --- | --- | --- |
| 런타임 | Node.js | ≥ 20.9 (개발 환경 22.x LTS) | Next.js 16의 `engines` 요구사항이다. |
| 프레임워크 | Next.js (App Router) | 16.3.6 | 사용자가 지정했다. 16.3은 패치가 6번 나온 안정 라인이다. |
| UI 라이브러리 | React / React DOM | 19.x (19.3.0) | Next.js 16의 peer 요구사항이다. |
| 언어 | TypeScript | 5.9.3 | `typescript-eslint`의 peer 범위가 `<6.1.0`이라 TS 7은 호환되지 않는다. 가장 넓게 검증된 5.9를 쓴다. |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities | 6.3.1 / 10.0.0 / 3.2.2 | 사용자가 지정했다. 키보드 센서와 스크린리더 안내(NFR-4, NFR-5)를 기본으로 제공하고, 터치 센서(FR-9)가 있다. |
| 스타일 | Tailwind CSS, @tailwindcss/postcss | 4.3.3 | 사용자가 지정했다. v4의 CSS-first 설정(`@import "tailwindcss"`, `@theme`)을 쓴다. |
| 스키마 검증 | zod | 4.x (4.6.5) | localStorage에서 읽은 데이터와 폼 입력(FR-6)을 같은 스키마로 검증한다. |
| 단위/컴포넌트 테스트 | Vitest, @vitejs/plugin-react, jsdom, Testing Library | 4.1.11 / 5.2.0 / 29.1.1 / RTL 16.3.3 | Vitest 5.0은 나온 지 4주밖에 안 돼서 V4 LTS 라인을 쓴다. |
| E2E 테스트 | Playwright | 1.63.0 | 실제 브라우저로 드래그, 키보드 조작, 새로고침 후 복원을 검증한다. Chromium(Chrome)과 Edge로 NFR-7을 확인한다. |
| 린트 | ESLint, eslint-config-next | 9.39.x (maintenance) / 16.3.6 | ESLint 10은 플러그인 생태계가 아직 따라오는 중이라 9 maintenance 라인을 쓴다. |
| 패키지 매니저 | npm | Node 22 번들 버전 | 추가 도구 없이 쓸 수 있다. `package-lock.json`으로 버전을 고정한다. |

**쓰지 않기로 한 것**
- 상태 관리 라이브러리(Zustand, Redux 등): 상태가 보드 하나뿐이라 `useReducer` + Context로 충분하다. 의존성이 적을수록 안정적이다.
- UI 컴포넌트 라이브러리: 컴포넌트가 다이얼로그 하나와 폼 정도라서 네이티브 `<dialog>` + Tailwind로 만든다.
- ID 생성 라이브러리: 브라우저 표준 `crypto.randomUUID()`를 쓴다.

## 3. Architecture Overview (아키텍처 개요)

클라이언트만 있는 단일 페이지 앱(SPA 성격)이다. Next.js는 라우팅, 빌드, 개발 서버 역할만 한다. 보드는 전부 Client Component에서 렌더링한다.

```
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                  │
│  app/page.tsx (Server Component, 정적 셸)                          │
│     └─ <BoardProvider>  ('use client')                           │
│           ├─ useReducer(boardReducer)  ◀── 도메인 로직(순수 함수)     │
│           ├─ useBoardPersistence ──▶ BoardRepository             │
│           │                            └─ localStorage           │
│           └─ <Board> (DndContext)                                │
│                 ├─ <Column> × 3 (useDroppable + SortableContext) │
│                 │     └─ <SortableCard> × N (useSortable)        │
│                 ├─ <DragOverlay>                                 │
│                 ├─ <CardFormDialog> / <ConfirmDialog>            │
│                 └─ <Toast> (저장 실패 알림)                         │
└──────────────────────────────────────────────────────────────────┘
```

### 계층

| 계층 | 위치 | 역할 | React 의존 |
| --- | --- | --- | --- |
| Domain | `src/lib/board/` | 타입, 상수, 리듀서, 이동·순서 재계산, 검증 스키마 | 없음(순수 TS) → NFR-10 |
| Persistence | `src/lib/storage/` | `BoardRepository` 인터페이스와 localStorage 구현(직렬화, 버전, 검증) | 없음 |
| State | `src/components/board/BoardProvider.tsx`, `src/hooks/` | 리듀서 연결, 저장과 롤백, 불러오기(hydration) | 있음 |
| UI | `src/components/` | 표시, 입력, dnd-kit 연결 | 있음 |

### 주요 아키텍처 결정

1. **상태는 컬럼의 순서 배열에서 나온다(C2 보장).** 정규화된 `columns[status]: cardId[]`가 유일한 기준이다. 카드의 `status`/`order` 필드는 리듀서가 배열을 바꿀 때 항상 같이 다시 계산한다. 그래서 상태와 위치가 서로 달라지는 경우가 구조적으로 생길 수 없다.
2. **드래그 중에는 임시 상태를 쓰고, 드롭할 때 확정한다.** 드래그를 시작할 때 스냅샷을 저장한다. `onDragOver`에서는 화면용 임시 상태만 바꾸고 저장하지 않는다. `onDragEnd`에서 확정하고 저장한다. `onDragCancel`(Esc)이나 유효하지 않은 곳에 드롭하면 스냅샷으로 되돌린다(FR-14, SC-5).
3. **낙관적 업데이트 후 저장하고, 실패하면 롤백한다.** 리듀서가 먼저 UI를 바꾼다(NFR-2). 그다음 동기식으로 `localStorage.setItem`을 호출한다. 예외(`QuotaExceededError` 등)가 나면 `lastSavedState`로 되돌리고 토스트를 띄운다(FR-18).
4. **SSR/hydration 안전.** 서버에는 localStorage가 없다. 그래서 첫 렌더에서는 보드 스켈레톤을 보여주고, 마운트한 뒤 `useEffect`에서 저장소를 읽어 `HYDRATE` 액션을 보낸다. hydration 불일치 경고가 생기지 않는다.
5. **저장소는 추상화한다.** `BoardRepository` 인터페이스(`load`, `save`)를 둔다. 나중에 백엔드 API 구현체로 바꿀 수 있다(이번 범위 밖).

## 4. Data Models (데이터 모델)

DB는 없다. 브라우저 `localStorage`의 키 하나에 JSON으로 저장한다.

### 4.1 도메인 타입 (`src/lib/board/types.ts`)

```ts
export const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  TODO: '할 일',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
};

export interface Card {
  id: string;          // crypto.randomUUID()
  title: string;       // trim 후 1~100자 (FR-4, FR-6)
  description: string; // 0~1000자, 없으면 ''
  status: Status;      // columns에서 파생, 리듀서가 동기화
  order: number;       // 컬럼 내 0-based 인덱스, 리듀서가 동기화
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

export interface BoardState {
  cards: Record<string, Card>;          // id → Card
  columns: Record<Status, string[]>;    // status → 정렬된 cardId 목록 (단일 진실 공급원)
}
```

### 4.2 저장 형식 (`localStorage["kanban-app:board"]`)

```json
{
  "version": 1,
  "savedAt": "2026-09-29T10:00:00.000Z",
  "board": {
    "cards": { "<uuid>": { "id": "<uuid>", "title": "...", "description": "", "status": "TODO", "order": 0, "createdAt": "...", "updatedAt": "..." } },
    "columns": { "TODO": ["<uuid>"], "IN_PROGRESS": [], "DONE": [] }
  }
}
```

- **버전 필드**: 나중에 스키마가 바뀌면 `migrations[version]` 함수로 올린다. 지금은 v1 하나뿐이다.
- **불러올 때 검증**(`zod`):
  1. JSON 파싱에 실패하거나 스키마가 맞지 않으면 빈 보드로 시작한다. 원본은 `kanban-app:board:corrupt-<timestamp>` 키로 백업하고 콘솔에 경고를 남긴다.
  2. 무결성을 확인한다. 모든 `columns` ID가 `cards`에 있어야 하고, 각 카드는 정확히 한 컬럼에만 있어야 한다. 그런 다음 `status`/`order`를 `columns` 기준으로 다시 계산한다(정규화).
- **용량**: 카드 하나가 최대 약 2.3KB(설명 1000자, UTF-16)다. 600장이면 약 1.4MB로, 일반적인 한도(약 5MB) 안에 들어간다. 한도를 넘으면 FR-18 흐름을 탄다.

### 4.3 검증 스키마 (`src/lib/board/schema.ts`)

```ts
export const cardInputSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력하세요.').max(100, '제목은 100자 이하여야 합니다.'),
  description: z.string().max(1000, '설명은 1000자 이하여야 합니다.').default(''),
});
```

## 5. API Design (API 설계)

**HTTP API는 없다**(backend는 범위 밖). 모듈 사이의 내부 인터페이스를 아래처럼 정의한다.

### 5.1 리듀서 액션 (`src/lib/board/actions.ts`)

| 액션 | 페이로드 | 효과 | 관련 요구사항 |
| --- | --- | --- | --- |
| `HYDRATE` | `{ board: BoardState }` | 저장된 상태로 초기화 | FR-17 |
| `ADD_CARD` | `{ id, title, description, now }` | TODO 맨 뒤에 추가 | FR-5 |
| `UPDATE_CARD` | `{ id, title, description, now }` | 제목·설명 수정, `updatedAt` 갱신 | FR-7 |
| `DELETE_CARD` | `{ id }` | 카드 삭제, 컬럼 순서 다시 계산 | FR-8 |
| `MOVE_CARD` | `{ id, toStatus, toIndex, now }` | 같은 컬럼이면 순서 변경, 다른 컬럼이면 상태와 순서 변경 | FR-10~12, 15, 16 |
| `RESTORE` | `{ board: BoardState }` | 스냅샷으로 복원(취소, 저장 실패 롤백) | FR-14, FR-18 |

- `id`와 `now`는 호출하는 쪽에서 넘긴다. 그래서 리듀서가 순수 함수로 남고 테스트 결과가 항상 같다.
- `MOVE_CARD`에서 상태가 바뀌었을 때만 `updatedAt`을 갱신한다. 같은 컬럼 안에서 순서만 바꾸면 갱신하지 않는다.

### 5.2 순수 함수 (`src/lib/board/operations.ts`)

```ts
moveCard(board: BoardState, id: string, toStatus: Status, toIndex: number, now: string): BoardState
findContainer(board: BoardState, id: string): Status | undefined  // id가 카드면 해당 컬럼, 컬럼 id면 그 컬럼
syncDerivedFields(board: BoardState): BoardState                    // status/order 재계산
createEmptyBoard(): BoardState
```

### 5.3 저장소 인터페이스 (`src/lib/storage/boardRepository.ts`)

```ts
export interface BoardRepository {
  load(): LoadResult;                  // { ok: true, board } | { ok: false, reason: 'empty' | 'corrupt' | 'unavailable' }
  save(board: BoardState): SaveResult; // { ok: true } | { ok: false, error: 'quota' | 'unavailable' | 'unknown' }
}
export const localStorageBoardRepository: BoardRepository;
```

## 6. Component Structure (컴포넌트 구조)

### 6.1 디렉터리

```
src/
├─ app/
│  ├─ layout.tsx            # <html lang="ko">, 폰트, globals.css
│  ├─ page.tsx              # <BoardProvider><Board/></BoardProvider>
│  └─ globals.css           # @import "tailwindcss"; @theme 토큰(컬럼 색 등)
├─ components/
│  ├─ board/
│  │  ├─ BoardProvider.tsx  # 'use client' · reducer + persistence + context
│  │  ├─ Board.tsx          # DndContext, 센서, 핸들러, DragOverlay, 안내 문구
│  │  ├─ BoardSkeleton.tsx  # hydration 전 표시
│  │  ├─ Column.tsx         # useDroppable + SortableContext, 헤더(이름·카드 수)
│  │  ├─ SortableCard.tsx   # useSortable 래퍼 (memo)
│  │  ├─ CardView.tsx       # 카드 표시 전용 (Overlay/목록에서 공용)
│  │  └─ AddCardButton.tsx
│  ├─ dialogs/
│  │  ├─ CardFormDialog.tsx # 생성/수정 공용, zod 검증 오류 표시
│  │  └─ ConfirmDialog.tsx  # 삭제 확인 (네이티브 <dialog>)
│  └─ ui/
│     └─ Toast.tsx          # role="alert" 저장 실패 알림
├─ hooks/
│  ├─ useBoard.ts           # context 접근 (state, dispatch 래퍼)
│  └─ useBoardDnd.ts        # 드래그 스냅샷/onDragStart·Over·End·Cancel 로직
└─ lib/
   ├─ board/                # types, schema, actions, reducer, operations, a11y(안내 문구)
   └─ storage/              # boardRepository, localStorageBoardRepository, migrations
tests/
├─ unit/                    # Vitest
└─ e2e/                     # Playwright
```

### 6.2 계층 구조와 책임

```
RootLayout
└─ Page
   └─ BoardProvider                (state, dispatch, persist, toast 상태)
      └─ Board                     (DndContext)
         ├─ Column[TODO|IN_PROGRESS|DONE]
         │  ├─ ColumnHeader        ("할 일 · 3")
         │  ├─ SortableContext(items = columns[status])
         │  │  └─ SortableCard → CardView (수정/삭제 버튼)
         │  └─ AddCardButton       (TODO 컬럼만)
         ├─ DragOverlay → CardView (드래그 중 떠 있는 카드)
         ├─ CardFormDialog
         ├─ ConfirmDialog
         └─ Toast
```

### 6.3 dnd-kit 구성 (`Board.tsx`, `useBoardDnd.ts`)

- **센서**
  - `PointerSensor`: `activationConstraint: { distance: 5 }`로 클릭과 드래그를 구분한다.
  - `TouchSensor`: `{ delay: 200, tolerance: 5 }`로 모바일 스크롤과 충돌하지 않게 한다(FR-9).
  - `KeyboardSensor`: `coordinateGetter: sortableKeyboardCoordinates`. Space/Enter로 집고, 방향키로 옮기고, Space/Enter로 놓고, Esc로 취소한다(NFR-4).
- **충돌 감지**: `closestCorners`. 컬럼이 여러 개인 정렬 목록에서 빈 컬럼과 컬럼 끝에 놓는 경우를 안정적으로 처리한다(FR-16).
- **드롭 대상**: 각 `Column`에 `useDroppable({ id: status })`를 등록한다. 카드가 없는 컬럼도 드롭 대상이 된다.
- **핸들러 흐름**
  1. `onDragStart`: `activeId`와 스냅샷 `dragStartBoard`를 저장한다.
  2. `onDragOver`: over가 다른 컬럼(또는 다른 컬럼의 카드)이면 임시 상태에서 카드를 그 컬럼의 해당 인덱스로 옮긴다. 이렇게 해야 placeholder가 보인다(FR-13). 저장은 하지 않는다.
  3. `onDragEnd`: `over`가 null이면 `RESTORE(snapshot)`한다. 아니면 최종 `MOVE_CARD`를 확정하고 한 번 저장한다.
  4. `onDragCancel`: `RESTORE(snapshot)`한다.
- **시각 피드백**: 원래 자리의 카드는 `opacity-40` placeholder로, 대상 컬럼은 `ring-2` 하이라이트로 보여준다. `DragOverlay`에는 `CardView` 복제본을 띄운다.
- **스크린리더 안내**(NFR-5): `DndContext`의 `accessibility.announcements`와 `screenReaderInstructions`를 한국어로 바꾼다.
  - 예: "‘보고서 작성’ 카드를 집었습니다. 현재 할 일 컬럼 2번째 위치입니다." / "진행 중 컬럼 1번째 위치로 이동했습니다." / "‘보고서 작성’ 카드를 완료 컬럼 3번째 위치에 놓았습니다." / "이동을 취소했습니다. 카드가 원래 위치로 돌아갔습니다."
- **성능**(NFR-1, NFR-3): `SortableCard`와 `CardView`는 `React.memo`로 감싼다. transform은 `CSS.Transform.toString`으로 GPU 합성을 쓴다. 드래그 중에 저장하지 않는다. 600장 규모에서는 가상화 없이 목표를 달성할 수 있다고 본다. SC-9 측정에서 미달하면 컬럼 내 `content-visibility: auto`를 먼저 적용한다.

### 6.4 레이아웃과 스타일

- 데스크톱(`lg:` ≥1024px): `grid grid-cols-3 gap-4`, 각 컬럼 안에서 세로 스크롤.
- 모바일(<768px): `flex overflow-x-auto snap-x snap-mandatory`로 가로 스크롤. 컬럼 너비는 `w-[85vw]`.
- 태블릿(768~1023px): 가로 스크롤로 3개 컬럼을 부분적으로 노출한다(NFR-8).
- 상태 구분: 컬럼 헤더에 텍스트 레이블과 색 배지를 함께 쓴다(NFR-6). 대비 4.5:1 이상인 조합은 `@theme` 토큰으로 정의한다.

## 7. State Management (상태 관리)

### 7.1 상태 구성

| 상태 | 위치 | 영속 여부 |
| --- | --- | --- |
| `board: BoardState` | `BoardProvider`의 `useReducer` | 저장함(localStorage) |
| `isHydrated: boolean` | `BoardProvider` | 저장 안 함 |
| `lastSavedBoard` | `BoardProvider`의 `useRef` | 저장 안 함(롤백 기준) |
| `dragStartBoard`, `activeId` | `useBoardDnd`의 `useRef`/`useState` | 저장 안 함 |
| 다이얼로그 열림, 편집 대상, 폼 오류 | 각 다이얼로그 로컬 state | 저장 안 함 |
| `toast` | `BoardProvider` | 저장 안 함 |

### 7.2 데이터 흐름

```
[사용자 입력/드롭]
      │
      ▼
 dispatch(action) ──▶ boardReducer (순수) ──▶ 새 board ──▶ UI 즉시 반영 (≤100ms, NFR-2)
      │
      ▼ (확정 액션만: ADD/UPDATE/DELETE/MOVE[onDragEnd])
 repository.save(board)
      ├─ ok   → lastSavedBoard = board
      └─ fail → dispatch(RESTORE(lastSavedBoard)) + toast("저장에 실패했습니다…")  (FR-18)
```

- **저장 시점**: `BoardProvider`는 `dispatch`를 감싼 `commit(action)`을 노출한다. `commit`은 리듀서를 먼저 계산하고(`boardReducer(current, action)`), 그 결과를 저장한 뒤 성공 여부에 따라 적용하거나 되돌린다. 드래그 중 임시 변경은 `preview(action)`으로 보내서 저장하지 않는다.
- **초기 로딩**: 마운트 → `repository.load()` → `HYDRATE` → `isHydrated = true`. 결과가 `corrupt`이면 빈 보드로 시작하고 토스트로 알린다.
- **탭 간 동기화(선택 구현)**: `window`의 `storage` 이벤트를 받아 다른 탭에서 바꾼 내용을 `HYDRATE`한다. 드래그 중에는 무시한다. 다중 사용자 실시간 동기화(A2)는 아니고, 같은 브라우저 안에서 일관성을 지키는 용도다.

## 8. Security Considerations (보안 고려사항)

| 항목 | 대응 |
| --- | --- |
| 인증/인가 | 범위 밖이다(A1: 단일 사용자, 로그인 없음). 데이터는 사용자 브라우저에만 있다. |
| XSS (NFR-9) | 제목과 설명은 React 텍스트 노드로만 렌더링한다(자동 이스케이프). `dangerouslySetInnerHTML`은 쓰지 않고 ESLint `react/no-danger`로 막는다. 설명의 줄바꿈은 `whitespace-pre-wrap`으로 처리한다(HTML 변환 없음). |
| 저장 데이터 변조 | localStorage 값은 신뢰하지 않는다. 불러올 때 zod 스키마와 무결성을 검사하고(§4.2), 실패하면 격리하고 초기화한다. 길이 제한을 넘는 값은 거부한다. |
| CSP / 보안 헤더 | `next.config.ts`의 `headers()`에 `Content-Security-Policy`(`default-src 'self'`, 개발 모드만 `'unsafe-eval'` 허용), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`를 설정한다. dnd-kit의 인라인 style은 `style-src 'self' 'unsafe-inline'`이 필요하다. |
| 민감 정보 | 개인정보나 비밀값을 저장하지 않는다. 환경 변수도 필요 없다. |
| 공급망 | `package-lock.json`으로 버전을 고정한다. `npm audit`에서 high 이상이 없어야 한다. 신규 의존성은 최소화한다. |

## 9. Testing Strategy (테스트 전략)

### 9.1 단위 테스트 — Vitest + jsdom (`tests/unit`)

| 대상 | 주요 케이스 | 명세 |
| --- | --- | --- |
| `boardReducer` / `moveCard` | 6가지 컬럼 간 이동 모두에서 status가 대상과 같음. 같은 컬럼 안 재정렬 시 status 유지, order 변경. 빈 컬럼으로 이동. 대상 인덱스(맨 앞/중간/맨 뒤) 삽입. 이동 후 `order`가 0..n-1로 연속됨 | FR-10~12, 15, 16, SC-3, SC-4 |
| `ADD_CARD` | TODO 맨 뒤에 추가, 카드 수 +1 | FR-5, SC-2 |
| `UPDATE_CARD` / `DELETE_CARD` | 필드 갱신, `updatedAt` 변경, 삭제 후 order 다시 계산 | FR-7, FR-8 |
| `cardInputSchema` | 빈 문자열, 공백만, 101자, 1001자는 거부. 앞뒤 공백 trim | FR-6, SC-8 |
| `localStorageBoardRepository` | 저장 후 불러오면 같은 값. 손상된 JSON은 `corrupt`로 처리하고 백업. `setItem`이 `QuotaExceededError`를 던지면 `{ ok:false, error:'quota' }` | FR-17, FR-18 |
| `syncDerivedFields` / 무결성 | 중복 ID와 고아 ID를 제거하고 status/order를 다시 맞춤 | C2 |

### 9.2 컴포넌트 테스트 — Testing Library (`tests/unit`)

- `CardFormDialog`: 빈 제목으로 제출하면 오류 메시지가 보이고 dispatch하지 않는다(SC-8).
- `ConfirmDialog`: 취소하면 삭제하지 않고, 확인하면 삭제한다(FR-8).
- `BoardProvider`: repository mock의 `save`가 실패하면 이전 상태로 되돌리고 `role="alert"` 토스트를 띄운다(FR-18).
- `Column`: 헤더에 이름과 카드 수를 표시한다(FR-3).

### 9.3 E2E 테스트 — Playwright (`tests/e2e`, Chromium/Edge/모바일)

| 시나리오 | 검증 | SC |
| --- | --- | --- |
| 첫 방문 | 3개 컬럼이 순서대로 보임 | SC-1 |
| 카드 생성 | TODO 맨 아래에 나타나고 카운트 +1 | SC-2 |
| 마우스 드래그 6방향 | `page.mouse` 단계 이동(`steps`)으로 드래그한 뒤 컬럼 소속과 `data-status` 확인 | SC-3 |
| 같은 컬럼 재정렬 | 순서 변경, 상태 유지 | SC-4 |
| 취소 | 드래그 중 Esc, 컬럼 밖 드롭 → 원위치 | SC-5 |
| 새로고침 복원 | 생성/수정/삭제/이동 후 `page.reload()` → 같은 상태 | SC-6 |
| 키보드 이동 | Tab으로 카드에 포커스 → Space → → → → Space로 TODO에서 DONE까지 이동 | SC-7 |
| 빈 제목 | 오류 메시지가 보이고 카드가 생성되지 않음 | SC-8 |
| 성능 | `addInitScript`로 카드 600장을 localStorage에 넣고 `load`까지 2초 미만인지 측정. 드래그 중 `requestAnimationFrame` 간격을 샘플링해 프레임 드롭 확인 | SC-9 |
| 모바일 | `devices['Pixel 7']`로 터치 드래그와 가로 스크롤 확인 | FR-9, NFR-8 |

- 접근성 자동 검사: `@axe-core/playwright`로 보드 화면에서 WCAG 2.1 AA 위반이 0건인지 확인한다(NFR-6).
- 테스트 셀렉터: `data-testid="column-TODO"`, `data-testid="card-<id>"`, `data-status` 속성을 쓴다.
- **완료 기준(SC-10)**: `npm run test`(Vitest)와 `npm run test:e2e`(Playwright)가 모두 통과해야 한다. 도메인 계층(`src/lib`) 라인 커버리지는 90% 이상이어야 한다.

## 10. Deployment Plan (배포 계획)

**이번 작업에서 배포는 하지 않는다.** 로컬 개발, 빌드, 검증 환경만 구성한다.

### 10.1 스크립트 (`package.json`)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  },
  "engines": { "node": ">=20.9.0" }
}
```

### 10.2 환경 구성

- 초기 생성: `npx create-next-app@16.3.6 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`을 실행한다. 그다음 TypeScript와 ESLint 버전을 §11에 맞게 고정한다.
- 환경 변수: 없다(`.env` 불필요).
- `playwright.config.ts`: `webServer: { command: 'npm run build && npm run start', port: 3000 }`로 프로덕션 빌드를 대상으로 E2E를 돌린다.
- `vitest.config.ts`: `environment: 'jsdom'`, `setupFiles: ['tests/unit/setup.ts']`(jest-dom matcher), `@/` alias.
- 로컬 품질 게이트: `lint` → `typecheck` → `test` → `build` → `test:e2e` 순서로 모두 통과해야 한다.

### 10.3 향후 확장 (참고용, 이번 범위 아님)

- 정적 산출물만으로 동작하므로 `output: 'export'`로 정적 호스팅(Vercel, GitHub Pages 등)에 올릴 수 있다.
- 백엔드를 도입하면 `BoardRepository`의 API 구현체만 추가하면 된다. UI와 리듀서는 바꾸지 않는다.

## 11. Dependencies (의존성)

> 2026-09-29 기준 npm 레지스트리에서 확인한 버전이다. `^`/`~` 없이 **정확한 버전으로 고정**하고(`save-exact=true`, `.npmrc`), `package-lock.json`을 커밋한다.

### 11.1 dependencies

| 패키지 | 버전 | 비고 |
| --- | --- | --- |
| `next` | 16.3.6 | latest 안정 버전 |
| `react` | 19.3.0 | |
| `react-dom` | 19.3.0 | |
| `@dnd-kit/core` | 6.3.1 | |
| `@dnd-kit/sortable` | 10.0.0 | peer `@dnd-kit/core ^6.3.0` |
| `@dnd-kit/utilities` | 3.2.2 | `CSS.Transform` |
| `zod` | 4.6.5 | |

### 11.2 devDependencies

| 패키지 | 버전 | 비고 |
| --- | --- | --- |
| `typescript` | 5.9.3 | TS 7은 typescript-eslint peer(`<6.1.0`) 범위 밖이라 제외 |
| `@types/react` | 19.3.0 | |
| `@types/react-dom` | 19.x (react-dom과 맞춤) | |
| `@types/node` | 22.20.4 | Node 22 LTS |
| `tailwindcss` | 4.3.3 | |
| `@tailwindcss/postcss` | 4.3.3 | |
| `eslint` | 9.39.5 | `maintenance` 태그, 안정 라인 |
| `eslint-config-next` | 16.3.6 | peer `eslint >=9` |
| `vitest` | 4.1.11 | `V4` 태그 |
| `@vitest/coverage-v8` | 4.1.11 | vitest와 같은 버전이어야 함 |
| `@vitejs/plugin-react` | 5.2.0 | peer vite ^7 |
| `jsdom` | 29.1.1 | 30.x는 7월에 나온 새 메이저라 제외 |
| `@testing-library/react` | 16.3.3 | |
| `@testing-library/dom` | 10.4.2 | RTL peer |
| `@testing-library/user-event` | 14.6.7 | |
| `@testing-library/jest-dom` | 6.10.0 | 7.x는 새 메이저라 제외 |
| `@playwright/test` | 1.63.0 | |
| `@axe-core/playwright` | 설치 시점 latest 안정 버전 | 접근성 E2E |

### 11.3 버전 선택 원칙

1. `latest` dist-tag의 정식 릴리스만 쓴다. `beta`/`rc`/`canary`/0.x 버전은 쓰지 않는다.
2. 나온 지 3개월이 안 된 새 메이저 버전은 쓰지 않고, 바로 앞 메이저의 최신 패치를 쓴다.
3. 설치한 뒤 `npm ls`로 peer 경고가 0건인지 확인한다. 경고가 있으면 이 표를 먼저 고친다.
