# Kanban App — 작업 목록 (Tasks)

> 기준 문서: [`spec.md`](./spec.md) · [`plan.md`](./plan.md)
> 작성일: 2026-09-29 · 브랜치: `frontend-setup`

## 개요

- 총 **31개 작업**, **8개 그룹**
- 작업은 의존성 순서대로 정렬했다. 앞 번호 작업이 끝나야 뒤 작업을 시작할 수 있다(같은 그룹 안에서 의존성이 없는 작업은 병렬 가능).
- **Status**: ⬜ Todo → ⏳ In progress → ✅ Done 순으로 갱신한다.
- **Required**: `Yes`는 명세의 요구사항·성공 기준을 충족하는 데 필요한 작업이다. `No`는 plan에서 "선택 구현"으로 표시한 작업이다.
- 도메인·저장소 작업은 **테스트를 먼저 쓰고(TDD)** 구현한다. 각 작업의 "완료 조건"은 명령이나 테스트로 확인할 수 있게 적었다.

| 그룹 | 작업 | 복잡도 |
| --- | --- | --- |
| G1. 프로젝트 셋업 | T-001 ~ T-005 | Low |
| G2. 도메인 로직 | T-006 ~ T-010 | Medium |
| G3. 저장소 | T-011 ~ T-012 | Medium |
| G4. 상태 관리 | T-013 ~ T-015 | Medium |
| G5. 보드 UI | T-016 ~ T-019 | Medium |
| G6. Drag & Drop | T-020 ~ T-023 | High |
| G7. 보안·성능 | T-024 ~ T-025 | Medium |
| G8. E2E 테스트·마무리 | T-026 ~ T-031 | High |

---

## G1. 프로젝트 셋업 (복잡도: Low)

### T-001 Next.js 프로젝트 생성과 의존성 버전 고정
- **Purpose**: plan §11에 정한 안정 버전으로 개발 환경의 기반을 만든다.
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: —
- **작업 내용**
  - `npx create-next-app@16.3.6 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`으로 생성한다(기존 `README.md`, `LICENSE`, `docs/`, `.claude/` 유지).
  - `.npmrc`에 `save-exact=true`를 넣는다.
  - `package.json`의 dependencies를 §11.1 버전으로 정확히 고정하고 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `zod`를 추가한다.
  - `typescript`를 5.9.3, `eslint`를 9.39.5로 고정한다. `engines.node`를 `>=20.9.0`으로 설정한다.
- **완료 조건**: `npm install` 성공, `npm ls`에 peer 경고 0건, `npm run dev`로 `http://localhost:3000` 응답, `package-lock.json` 생성.

### T-002 ESLint·TypeScript 설정과 npm 스크립트
- **Purpose**: 코드 품질 게이트(lint, typecheck)를 만들고 XSS 위험 코드를 원천 차단한다(NFR-9).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-001
- **작업 내용**
  - `tsconfig.json`에 `strict: true`를 확인한다.
  - ESLint 설정에 `react/no-danger: error`를 추가한다.
  - plan §10.1의 `scripts`(`lint`, `typecheck`, `test`, `test:watch`, `test:coverage`, `test:e2e`)를 추가한다.
- **완료 조건**: `npm run lint`와 `npm run typecheck`가 오류 없이 통과한다. `dangerouslySetInnerHTML`을 쓴 임시 파일에서 lint가 실패하는 것을 확인한 뒤 삭제한다.

### T-003 Vitest 단위 테스트 환경
- **Purpose**: 도메인 로직과 컴포넌트를 테스트할 수 있게 한다(NFR-10).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-001
- **작업 내용**
  - devDependencies 설치: `vitest@4.1.11`, `@vitest/coverage-v8@4.1.11`, `@vitejs/plugin-react@5.2.0`, `jsdom@29.1.1`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2`, `@testing-library/user-event@14.6.7`, `@testing-library/jest-dom@6.10.0`.
  - `vitest.config.ts`: `environment: 'jsdom'`, `setupFiles: ['tests/unit/setup.ts']`, `@/` alias, 커버리지 대상 `src/lib/**`.
  - `tests/unit/setup.ts`에서 jest-dom matcher를 등록한다.
- **완료 조건**: 샘플 테스트(`expect(1).toBe(1)`, `toBeInTheDocument` 1개)로 `npm run test`가 통과한다.

### T-004 Playwright E2E 환경
- **Purpose**: 실제 브라우저에서 성공 기준(SC)을 검증할 수 있게 한다.
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-001
- **작업 내용**
  - `@playwright/test@1.63.0`, `@axe-core/playwright`(설치 시점 latest 안정 버전)를 설치하고 `npx playwright install`로 브라우저를 설치한다.
  - `playwright.config.ts`: `testDir: 'tests/e2e'`, `webServer: { command: 'npm run build && npm run start', port: 3000 }`, projects = Chromium·Edge·`Pixel 7` (NFR-7 변경으로 Firefox·WebKit 제외).
  - 테스트마다 localStorage가 비어 있는 상태로 시작하도록 fixture를 만든다.
- **완료 조건**: "페이지가 열리고 `<html lang="ko">`다"를 확인하는 샘플 E2E가 4개 project에서 모두 통과한다.

### T-005 Tailwind 테마 토큰과 루트 레이아웃
- **Purpose**: 한국어 UI와 대비 기준을 만족하는 색 토큰을 준비한다(A5, NFR-6).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-001
- **작업 내용**
  - `src/app/layout.tsx`: `<html lang="ko">`, 메타데이터(title "칸반 보드").
  - `src/app/globals.css`: `@import "tailwindcss";`, `@theme`에 컬럼별 배지·배경·텍스트 색 토큰(TODO/IN_PROGRESS/DONE)을 정의한다.
  - create-next-app 기본 예제 마크업을 제거한다.
- **완료 조건**: 모든 텍스트/배경 토큰 조합의 대비가 4.5:1 이상이다(대비 계산 결과를 주석으로 기록). `npm run build` 통과.

---

## G2. 도메인 로직 (복잡도: Medium)

> 모든 코드는 `src/lib/board/`에 두며 React에 의존하지 않는다. 테스트는 `tests/unit/board/`에 둔다.

### T-006 도메인 타입과 상수
- **Purpose**: 카드·보드 데이터 모델을 한곳에서 정의한다(FR-1, FR-4, C1).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-003
- **작업 내용**: `types.ts`에 `STATUSES`, `Status`, `STATUS_LABEL`, `Card`, `BoardState`를 정의하고(plan §4.1), `createEmptyBoard()`를 만든다.
- **완료 조건**: `createEmptyBoard()`가 카드 0장, 컬럼 3개(`TODO`→`IN_PROGRESS`→`DONE` 순)를 반환하는 테스트 통과. `STATUSES` 순서 테스트 통과.

### T-007 zod 검증 스키마
- **Purpose**: 카드 입력과 저장된 데이터를 같은 규칙으로 검증한다(FR-4, FR-6, SC-8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-006
- **작업 내용**: `schema.ts`에 `cardInputSchema`(plan §4.3), `cardSchema`, `boardStateSchema`, `storedBoardSchema`(`{ version: 1, savedAt, board }`)를 정의한다.
- **완료 조건**: 테스트 통과 — 빈 문자열·공백만·101자 제목 거부, 1001자 설명 거부, 앞뒤 공백 trim, 정상 입력 통과, 필드가 빠지거나 `status`가 잘못된 저장 데이터 거부.

### T-008 파생 필드 동기화와 무결성 보정
- **Purpose**: 카드의 상태가 오직 컬럼 위치로만 정해지도록 보장한다(C2).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-006
- **작업 내용**: `operations.ts`에 `syncDerivedFields`(columns 기준으로 `status`/`order` 재계산), `normalizeBoard`(columns에 없는 카드 제거, cards에 없는 ID 제거, 중복 ID는 첫 위치만 유지), `findContainer`(카드 ID 또는 컬럼 ID → Status)를 만든다.
- **완료 조건**: 테스트 통과 — status가 컬럼과 다른 카드가 보정됨, `order`가 0..n-1로 연속됨, 고아 ID·중복 ID 제거, `findContainer`가 카드 ID·컬럼 ID·없는 ID에 대해 올바른 값 반환.

### T-009 카드 이동 함수 `moveCard`
- **Purpose**: Drag & Drop의 핵심 규칙(컬럼 간 이동, 같은 컬럼 재정렬)을 UI와 분리해 검증한다(FR-10~12, FR-15, FR-16, NFR-10).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-008
- **작업 내용**: `moveCard(board, id, toStatus, toIndex, now)`를 구현한다. 불변 업데이트, 결과에 `syncDerivedFields` 적용, 상태가 바뀔 때만 `updatedAt` 갱신, `toIndex` 범위 밖은 끝으로 보정, 없는 ID는 원래 board 반환.
- **완료 조건**: 테스트 통과 — 6방향 이동 모두 `status`가 대상 컬럼과 같음(SC-3), 같은 컬럼 재정렬 시 status·`updatedAt` 유지(SC-4), 빈 컬럼으로 이동, 맨 앞/중간/맨 뒤 삽입, 원본 board가 변경되지 않음.

### T-010 액션 정의와 `boardReducer`
- **Purpose**: 모든 상태 변경을 하나의 순수 함수로 모은다(FR-5, FR-7, FR-8, plan §5.1).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-009
- **작업 내용**: `actions.ts`에 `HYDRATE`, `ADD_CARD`, `UPDATE_CARD`, `DELETE_CARD`, `MOVE_CARD`, `RESTORE` 타입을 정의하고 `reducer.ts`에 `boardReducer`를 구현한다. `id`, `now`는 페이로드로 받는다.
- **완료 조건**: 테스트 통과 — `ADD_CARD`는 TODO 맨 뒤에 추가되고 개수 +1(SC-2), `UPDATE_CARD`는 제목·설명·`updatedAt` 갱신, `DELETE_CARD` 후 order 재계산, `MOVE_CARD`는 `moveCard`와 같은 결과, `HYDRATE`/`RESTORE`는 전달한 board로 교체. `src/lib/board` 라인 커버리지 90% 이상.

---

## G3. 저장소 (복잡도: Medium)

### T-011 `BoardRepository`와 localStorage 구현
- **Purpose**: 보드 상태를 새로고침 후에도 유지한다(FR-17, G4).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-007, T-008
- **작업 내용**: `src/lib/storage/boardRepository.ts`에 인터페이스와 `LoadResult`/`SaveResult` 타입(plan §5.3)을 정의한다. `localStorageBoardRepository.ts`에서 키 `kanban-app:board`에 `{ version: 1, savedAt, board }`로 저장하고, 읽을 때 `storedBoardSchema` 검증 후 `normalizeBoard`를 적용한다.
- **완료 조건**: 테스트 통과 — 저장한 board를 불러오면 같은 값, 키가 없으면 `{ ok:false, reason:'empty' }`, `localStorage` 접근이 예외를 던지면 `'unavailable'`.

### T-012 손상 데이터 처리, 저장 실패 매핑, 마이그레이션 틀
- **Purpose**: 잘못된 저장 데이터나 용량 초과에도 앱이 멈추지 않게 한다(FR-18, plan §4.2, §8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-011
- **작업 내용**
  - JSON 파싱 실패·스키마 불일치 시 원본을 `kanban-app:board:corrupt-<timestamp>`로 백업하고 `console.warn` 후 `{ ok:false, reason:'corrupt' }` 반환.
  - `setItem` 예외를 `QuotaExceededError` → `'quota'`, 접근 불가 → `'unavailable'`, 기타 → `'unknown'`으로 매핑.
  - `migrations.ts`: `version`별 변환 함수 맵(현재 v1 항등)과 알 수 없는 버전 처리.
- **완료 조건**: 테스트 통과 — 깨진 JSON/잘못된 스키마는 `corrupt` 반환과 백업 키 생성, `setItem` mock이 `QuotaExceededError`를 던지면 `{ ok:false, error:'quota' }`, 미래 버전 데이터는 `corrupt` 처리.

---

## G4. 상태 관리 (복잡도: Medium)

### T-013 `BoardProvider`와 초기 로딩(hydration)
- **Purpose**: 저장된 보드를 hydration 불일치 없이 화면에 복원한다(FR-17, plan §3 결정 4).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-010, T-012
- **작업 내용**
  - `src/components/board/BoardProvider.tsx`(`'use client'`): `useReducer(boardReducer, createEmptyBoard())`, 마운트 시 `repository.load()` → `HYDRATE` → `isHydrated = true`. repository는 prop으로 주입할 수 있게 한다(테스트용).
  - `src/hooks/useBoard.ts`: context 접근 훅(Provider 밖에서 쓰면 오류).
  - `BoardSkeleton.tsx`: hydration 전 표시.
- **완료 조건**: 컴포넌트 테스트 통과 — 첫 렌더에 스켈레톤, 이후 저장된 카드 표시. `load`가 `corrupt`이면 빈 보드와 안내 토스트 상태. 브라우저 콘솔에 hydration 경고 없음(`npm run dev`로 확인).

### T-014 `commit`/`preview`, 저장 실패 롤백, 토스트
- **Purpose**: 화면을 즉시 갱신하고, 저장 실패 시 마지막으로 저장에 성공한 상태로 되돌린다(NFR-2, FR-18).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-013
- **작업 내용**
  - `commit(action)`: 리듀서 결과를 계산해 저장 → 성공 시 적용하고 `lastSavedBoard` 갱신, 실패 시 `RESTORE(lastSavedBoard)`와 토스트("저장에 실패했습니다. 마지막으로 저장된 상태로 되돌렸습니다.").
  - `preview(action)`: 저장 없이 화면용 상태만 변경(드래그 중 사용).
  - `src/components/ui/Toast.tsx`: `role="alert"`, 자동 닫힘(5초)과 닫기 버튼.
- **완료 조건**: 컴포넌트 테스트 통과 — save 성공 시 상태 반영과 `lastSavedBoard` 갱신, save 실패 mock 시 이전 상태 복원과 `role="alert"` 표시, `preview`는 save를 호출하지 않음.

### T-015 탭 간 동기화 (선택)
- **Purpose**: 같은 브라우저의 여러 탭에서 보드가 어긋나지 않게 한다(plan §7.2 선택 구현).
- **Required**: No
- **Status**: ✅ Done
- **Depends on**: T-014
- **작업 내용**: `window`의 `storage` 이벤트(키 `kanban-app:board`)를 받아 검증 후 `HYDRATE`하고 `lastSavedBoard`를 갱신한다. 드래그 중에는 무시한다.
- **완료 조건**: 컴포넌트 테스트에서 `StorageEvent`를 발생시키면 화면이 갱신되고, 드래그 중 플래그가 켜져 있으면 무시된다.

---

## G5. 보드 UI (복잡도: Medium)

### T-016 보드·컬럼 레이아웃
- **Purpose**: 3개 컬럼을 순서대로 보여주고 각 컬럼의 카드 수를 표시한다(FR-1~3, NFR-6, NFR-8, SC-1).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-005, T-013
- **작업 내용**
  - `src/app/page.tsx`: `<BoardProvider><Board /></BoardProvider>`.
  - `Board.tsx`(이 단계에서는 DnD 없이 레이아웃만), `Column.tsx`: 헤더에 텍스트 레이블 + 색 배지 + 카드 수("할 일 · 3"), `data-testid="column-<STATUS>"`.
  - 반응형: `lg:` 이상 `grid-cols-3`, 그 미만은 `overflow-x-auto snap-x`, 모바일 컬럼 너비 `w-[85vw]`.
  - 컬럼 이름은 편집·추가·삭제 UI를 두지 않는다(FR-2).
- **완료 조건**: 컴포넌트 테스트 — 컬럼 3개가 "할 일, 진행 중, 완료" 순으로 렌더링되고 헤더 카드 수가 정확함. 375px·1280px 폭에서 수동 확인(가로 페이지 스크롤은 컬럼 영역에만 발생).

### T-017 카드 표시 컴포넌트 `CardView`
- **Purpose**: 카드 제목·설명을 안전하게 표시하고 수정·삭제 진입점을 제공한다(FR-7, FR-8, NFR-9).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-016
- **작업 내용**: `CardView.tsx`(`React.memo`): 제목, 설명(`whitespace-pre-wrap`, 텍스트 노드로만 출력), 수정·삭제 버튼(`aria-label` 포함), `data-testid="card-<id>"`, `data-status`.
- **완료 조건**: 컴포넌트 테스트 — `<script>alert(1)</script>` 제목이 문자열 그대로 표시되고 `script` 요소가 생기지 않음. 줄바꿈 유지. 버튼 클릭 시 콜백 호출.

### T-018 카드 생성·수정 다이얼로그
- **Purpose**: 카드를 만들고 고칠 수 있게 하고, 빈 제목을 막는다(FR-5, FR-6, FR-7, SC-2, SC-8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-007, T-014, T-017
- **작업 내용**
  - `CardFormDialog.tsx`: 네이티브 `<dialog>`(`showModal`), 생성/수정 모드 공용, `cardInputSchema`로 검증해 필드 아래 오류 표시(`aria-invalid`, `aria-describedby`), 글자 수 표시, 열릴 때 제목에 포커스, 닫히면 트리거 버튼으로 포커스 복귀.
  - `AddCardButton.tsx`: TODO 컬럼에만 표시.
  - 제출 시 `commit(ADD_CARD | UPDATE_CARD)`, `id`는 `crypto.randomUUID()`, `now`는 `new Date().toISOString()`.
- **완료 조건**: 컴포넌트 테스트 — 빈 제목·공백만 제목 제출 시 오류 메시지가 보이고 commit 미호출, 정상 제출 시 TODO 맨 아래에 추가되고 카드 수 +1, 수정 모드에서 기존 값이 채워지고 저장 후 반영.

### T-019 삭제 확인 다이얼로그
- **Purpose**: 실수로 카드를 지우지 않도록 한 번 확인한다(FR-8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-014, T-017
- **작업 내용**: `ConfirmDialog.tsx`: 네이티브 `<dialog>`, 카드 제목을 포함한 확인 문구, "취소"(기본 포커스)/"삭제" 버튼, Esc는 취소. 확인 시 `commit(DELETE_CARD)`.
- **완료 조건**: 컴포넌트 테스트 — 취소·Esc 시 카드 유지, 확인 시 카드 삭제와 컬럼 카드 수 -1.

---

## G6. Drag & Drop (복잡도: High)

### T-020 dnd-kit 기본 연결과 같은 컬럼 재정렬
- **Purpose**: 마우스·터치·키보드로 카드를 끌 수 있게 하고, 같은 컬럼 안에서 순서를 바꾼다(FR-9, FR-11, SC-4).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-018, T-019
- **작업 내용**
  - `Board.tsx`에 `DndContext`: `PointerSensor({ distance: 5 })`, `TouchSensor({ delay: 200, tolerance: 5 })`, `KeyboardSensor({ coordinateGetter: sortableKeyboardCoordinates })`, `collisionDetection: closestCorners`.
  - `Column.tsx`: `useDroppable({ id: status })` + `SortableContext(items = columns[status], verticalListSortingStrategy)`.
  - `SortableCard.tsx`(`React.memo`): `useSortable`, `CSS.Transform.toString`, 카드 안의 버튼 클릭이 드래그로 인식되지 않게 처리.
  - `DragOverlay`에 `CardView` 복제본 표시.
  - 같은 컬럼 드롭 시 `commit(MOVE_CARD)`.
- **완료 조건**: 수동 확인 — 마우스로 같은 컬럼 안 순서 변경 후 새로고침해도 유지, 수정·삭제 버튼 클릭이 정상 동작. `npm run lint`/`typecheck` 통과.

### T-021 컬럼 간 이동, 스냅샷, 취소 처리 (`useBoardDnd`)
- **Purpose**: 다른 컬럼에 놓으면 상태가 바뀌고, 취소하면 원래대로 돌아가게 한다(FR-10, FR-12, FR-14~16, SC-3, SC-5).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-020
- **작업 내용**: `src/hooks/useBoardDnd.ts`
  - `onDragStart`: `activeId`와 `dragStartBoard` 스냅샷 저장.
  - `onDragOver`: `findContainer`로 대상 컬럼·인덱스를 계산해 다른 컬럼이면 `preview(MOVE_CARD)`(빈 컬럼 포함).
  - `onDragEnd`: `over`가 없으면 `RESTORE(snapshot)`(저장 없음), 있으면 최종 위치로 `commit(MOVE_CARD)` 1회.
  - `onDragCancel`: `RESTORE(snapshot)`.
  - 핸들러의 위치 계산 로직은 순수 함수(`resolveDropTarget`)로 분리해 단위 테스트한다.
- **완료 조건**: `resolveDropTarget` 단위 테스트(카드 위·빈 컬럼 위·컬럼 끝) 통과. 수동 확인 — 6방향 이동, 빈 컬럼 드롭, Esc 취소 시 원위치, 드래그 한 번에 저장 1회(`localStorage.setItem` 호출 횟수 확인).

### T-022 드래그 시각 피드백
- **Purpose**: 드래그 중 카드가 들어갈 위치와 대상 컬럼을 보여준다(FR-13).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-021
- **작업 내용**: 원래 자리 카드 `opacity-40` placeholder, `isOver`인 컬럼에 `ring-2` 하이라이트, 드래그 중 커서 `grabbing`, DragOverlay 카드에 그림자. `prefers-reduced-motion`이면 애니메이션 최소화.
- **완료 조건**: 수동 확인 — 다른 컬럼 위로 끌면 해당 컬럼이 강조되고 카드 사이에 자리가 생김. 컴포넌트 테스트 — `isOver` 상태에서 강조 클래스 적용.

### T-023 키보드 조작과 한국어 스크린리더 안내
- **Purpose**: 마우스 없이도 카드를 옮기고, 스크린리더 사용자에게 진행 상황을 알린다(NFR-4, NFR-5, US8, SC-7).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-021
- **작업 내용**
  - `src/lib/board/a11y.ts`: `screenReaderInstructions`와 `announcements`(onDragStart/Over/End/Cancel)를 한국어로 생성하는 순수 함수. 카드 제목, 컬럼 이름, 위치(n번째)를 포함한다(plan §6.3 예시 문구).
  - `DndContext`의 `accessibility`에 연결. 카드에 `aria-roledescription="이동 가능한 카드"`.
  - 키보드로 옆 컬럼(빈 컬럼 포함)까지 이동되는지 확인하고, 안 되면 `coordinateGetter`를 보완한다.
- **완료 조건**: `a11y.ts` 단위 테스트(각 이벤트 문구) 통과. 수동 확인 — Tab → Space → 방향키 → Space로 TODO에서 DONE까지 이동, Esc로 취소, live region에 한국어 문구 출력.

---

## G7. 보안·성능 (복잡도: Medium)

### T-024 보안 헤더(CSP 등) 설정
- **Purpose**: XSS와 클릭재킹 위험을 추가로 줄인다(NFR-9, plan §8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-020
- **작업 내용**: `next.config.ts`의 `headers()`에 `Content-Security-Policy`(`default-src 'self'`, `style-src 'self' 'unsafe-inline'`, 개발 모드만 `script-src`에 `'unsafe-eval'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`를 설정한다. Next.js 인라인 스크립트 때문에 필요한 설정(nonce 또는 허용 범위)은 문서에 근거를 남긴다.
- **완료 조건**: `npm run build && npm run start` 후 응답 헤더에 4개 헤더가 있고, 보드 사용(생성·드래그·삭제) 중 콘솔에 CSP 위반이 0건. `npm audit --audit-level=high` 통과.

### T-025 대량 카드 성능 확인과 최적화
- **Purpose**: 카드 600장에서도 빠르게 열리고 부드럽게 드래그되게 한다(NFR-1, NFR-3, SC-9).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-022
- **작업 내용**
  - `tests/fixtures/seedBoard.ts`: 컬럼당 200장(설명 포함)의 저장 데이터를 만드는 함수(E2E와 수동 확인 공용).
  - React DevTools Profiler로 드래그 중 리렌더가 관련 카드·컬럼으로 한정되는지 확인하고, 필요하면 `useMemo`/`useCallback`으로 props를 안정화한다.
  - 목표 미달 시 컬럼 목록에 `content-visibility: auto`를 적용한다.
- **완료 조건**: 600장 상태에서 프로덕션 빌드 기준 초기 로딩 2초 이내, Performance 패널에서 드래그 중 긴 프레임(>50ms)이 반복되지 않음. 측정값을 이 문서의 작업 메모나 PR 설명에 기록.

---

## G8. E2E 테스트·마무리 (복잡도: High)

> `tests/e2e/`에 작성하며 Chromium·Edge에서 실행한다(NFR-7). 셀렉터는 `data-testid`와 `data-status`를 쓴다.

### T-026 E2E: 보드 표시와 카드 CRUD
- **Purpose**: 기본 화면과 카드 관리 흐름을 실제 브라우저에서 검증한다(SC-1, SC-2, SC-8, FR-7, FR-8).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-004, T-019
- **작업 내용**: `board.spec.ts` — 첫 방문 시 3개 컬럼 순서, 카드 생성 후 TODO 맨 아래 표시와 카운트 +1, 빈 제목 오류와 미생성, 카드 수정 반영, 삭제 확인에서 취소/확인 동작.
- **완료 조건**: Chromium·Edge에서 모두 통과.

### T-027 E2E: 마우스 드래그 이동·재정렬·취소
- **Purpose**: Drag & Drop 핵심 동작을 실제 브라우저에서 검증한다(SC-3, SC-4, SC-5, FR-16).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-021, T-026
- **작업 내용**: `dnd.spec.ts` — `page.mouse` 단계 이동(`steps`) 헬퍼 작성, 6방향 이동 후 소속 컬럼과 `data-status` 확인, 빈 컬럼 드롭, 같은 컬럼 재정렬(상태 유지), 드래그 중 Esc와 컬럼 밖 드롭 시 원위치.
- **완료 조건**: Chromium·Edge에서 모두 통과, 5회 반복 실행(`--repeat-each=5`)에서 flaky 없음.

### T-028 E2E: 새로고침 복원과 저장 실패
- **Purpose**: 변경 내용이 유지되고, 저장 실패 시 안전하게 되돌아가는지 검증한다(SC-6, FR-17, FR-18).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-027
- **작업 내용**: `persistence.spec.ts` — 생성·수정·삭제·이동 후 `page.reload()`로 같은 상태 확인. `addInitScript`로 `Storage.prototype.setItem`이 `QuotaExceededError`를 던지게 한 뒤 카드 이동 시 원위치와 알림 표시 확인. 손상된 저장 데이터로 시작하면 빈 보드와 안내 표시 확인.
- **완료 조건**: Chromium·Edge에서 모두 통과.

### T-029 E2E: 키보드 조작과 접근성 검사
- **Purpose**: 키보드만으로 사용할 수 있고 접근성 기준을 지키는지 검증한다(SC-7, NFR-4~6).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-023, T-026
- **작업 내용**: `a11y.spec.ts` — Tab으로 카드 포커스 → Space → `ArrowRight` → Space로 TODO에서 DONE까지 이동하고 `data-status="DONE"` 확인, Esc 취소 확인, live region 문구 확인. `@axe-core/playwright`로 빈 보드·카드 있는 보드·다이얼로그 열린 상태에서 WCAG 2.1 AA 위반 0건 확인.
- **완료 조건**: Chromium·Edge에서 모두 통과, axe 위반 0건.

### T-030 E2E: 모바일 터치와 성능
- **Purpose**: 모바일 사용성과 대량 데이터 성능을 자동으로 확인한다(FR-9, NFR-8, SC-9).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-025, T-027
- **작업 내용**
  - `mobile.spec.ts`(`Pixel 7` project): 컬럼 가로 스크롤, 롱프레스 후 터치 드래그로 컬럼 간 이동.
  - `performance.spec.ts`(Chromium): `addInitScript`로 600장 주입 → 첫 카드 표시까지 2초 미만, 드래그 중 `requestAnimationFrame` 간격을 샘플링해 50ms 초과 프레임 비율이 5% 미만.
- **완료 조건**: 두 spec 모두 통과.

### T-031 최종 품질 게이트와 문서 정리
- **Purpose**: 모든 성공 기준을 한 번에 확인하고 다음 사람이 바로 실행할 수 있게 한다(SC-10).
- **Required**: Yes
- **Status**: ✅ Done
- **Depends on**: T-024, T-028, T-029, T-030
- **작업 내용**
  - `lint` → `typecheck` → `test:coverage` → `build` → `test:e2e` 순서로 전체 실행.
  - `README.md`에 요구 Node 버전, 설치·실행·테스트 명령, 데이터 저장 위치(localStorage 키)와 범위 밖 항목(backend·배포)을 정리.
  - 아래 추적표의 모든 항목이 테스트나 확인 기록과 연결됐는지 점검.
- **완료 조건**: 5개 명령 모두 통과, `src/lib` 라인 커버리지 90% 이상, `npm ls` peer 경고 0건, `npm audit --audit-level=high` 통과.

---

## 요구사항 추적표

| 명세 항목 | 작업 |
| --- | --- |
| FR-1~3 (컬럼 3개, 고정, 헤더 카운트) | T-006, T-016, T-026 |
| FR-4 (카드 모델) | T-006, T-007 |
| FR-5~6 (생성, 빈 제목 차단) | T-007, T-010, T-018, T-026 |
| FR-7~8 (수정, 삭제 확인) | T-010, T-017, T-018, T-019, T-026 |
| FR-9 (마우스·터치) | T-020, T-030 |
| FR-10~12, FR-15~16 (이동 규칙) | T-009, T-020, T-021, T-027 |
| FR-13 (시각 피드백) | T-022 |
| FR-14 (취소 시 원위치) | T-021, T-027 |
| FR-17 (영구 저장) | T-011, T-013, T-028 |
| FR-18 (저장 실패 롤백) | T-012, T-014, T-028 |
| NFR-1~3 (성능) | T-014, T-025, T-030 |
| NFR-4~5 (키보드, 스크린리더) | T-020, T-023, T-029 |
| NFR-6 (색 대비, 텍스트 레이블) | T-005, T-016, T-029 |
| NFR-7 (브라우저 지원) | T-004, T-026~T-029 |
| NFR-8 (반응형) | T-016, T-030 |
| NFR-9 (XSS) | T-002, T-017, T-024 |
| NFR-10 (로직 분리, 단위 테스트) | T-006~T-010, T-021, T-023 |
| C2 (상태 = 컬럼 위치) | T-008, T-009 |
| A5 (한국어 UI) | T-005, T-023 |
| SC-1~8 | T-026~T-029 |
| SC-9 | T-025, T-030 |
| SC-10 | T-031 |

---

## 구현 메모 (2026-09-29, `/sdd:implement --all`)

### 최종 검증 결과
| 항목 | 결과 |
| --- | --- |
| `npm run lint` / `npm run typecheck` | 통과 |
| `npm run test:coverage` | 11개 파일, 95개 테스트 통과. `src/lib` 라인 99.25%, 구문 98.08%, 분기 94.56% |
| `npm run build` | 통과 (`/`는 정적 렌더링) |
| E2E (`chromium`, `edge`, `mobile`) | 69개 통과(`--repeat-each=3`으로 207회 실패 없음). 드래그·키보드·모바일·저장 관련 spec은 `--repeat-each=5`에서도 실패 없음 |
| E2E (`firefox`, `webkit`) | NFR-7을 Chrome·Edge로 좁혀 설정에서 제외했다(2026-09-29). 대신 `edge` 프로젝트를 추가했다 |
| `npm ls` peer 경고 / `npm audit --audit-level=high` | 0건 / 0건 |
| 성능 (SC-9, 600장) | 초기 로딩 약 0.4~0.5초. 드래그 중 50ms 초과 프레임 약 2% (최대 약 180ms, 컬럼 간 미리보기 순간) |

### plan과 달라진 점
- **센서**: `PointerSensor` 대신 `MouseSensor` + `TouchSensor`. PointerSensor는 터치에도 반응해 TouchSensor의 200ms 지연(스크롤 구분)이 무력화된다. 카드 안 버튼에서는 드래그가 시작되지 않도록 센서를 감쌌다.
- **충돌 감지**: `closestCorners`만 쓰면 컬럼 밖에 놓아도 가장 가까운 컬럼으로 들어가 FR-14를 만족할 수 없다. 포인터가 컬럼 안에 있을 때만 그 컬럼에서 `closestCorners`를 쓰고, 키보드 드래그는 `closestCorners`를 그대로 쓴다.
- **hydration**: `useEffect`에서 불러오는 대신 `useSyncExternalStore`(클라이언트 여부) + 초기화 함수에서 한 번 읽기. React 19 lint 규칙(`set-state-in-effect`)을 따르고, 서버·hydration 렌더는 스켈레톤이라 불일치가 없다.
- **카드 역할**: 카드 안에 수정·삭제 버튼이 있어 `role="button"` 대신 `role="group"` + `aria-roledescription="이동 가능한 카드"`를 쓴다(중첩 인터랙티브 방지).
- **CSP**: nonce는 동적 렌더링에서만 동작하므로 Next.js 가이드의 nonce 없는 정책(`script-src 'self' 'unsafe-inline'`)을 쓴다. zod의 eval 탐지로 CSP 위반이 보고되어 `z.config({ jitless: true })`로 껐다. 로컬 http 테스트 때문에 `upgrade-insecure-requests`는 넣지 않았다.

### 구현 중 발견해 고친 문제
- 그리드 컬럼 높이가 내용에 따라 줄어 드래그 중 컬럼 아래가 "놓을 수 없는 영역"이 됨 → 컬럼 높이를 화면 기준으로 고정.
- 모바일에서 스크롤 스냅(mandatory)이 자동 스크롤을 되돌려 옆 컬럼으로 옮길 수 없음 → 드래그 중에는 스냅 해제.
- 손상 데이터 안내 토스트가 서버 HTML과 달라 hydration을 다시 하며 백업이 2번 생김 → 토스트는 hydration 이후에만 렌더링.
- 드래그 시작 안내("집었습니다")가 제자리 이동 안내로 바로 덮임 → 제자리에서는 안내 생략.
- **개발 서버에서 다이얼로그(추가·수정·삭제 확인)가 열리지 않음** (사용자 제보): StrictMode가 이펙트를 정리 후 다시 실행할 때, 정리 단계의 `close()`가 만든 close 이벤트가 비동기로 늦게 도착해 다시 연 다이얼로그를 닫았다. E2E가 프로덕션 빌드로만 돌아 놓쳤다 → 다이얼로그가 열려 있으면 close 이벤트를 무시. jsdom 폴리필도 브라우저처럼 비동기로 바꾸고 StrictMode 회귀 테스트(`tests/unit/components/dialogs.test.tsx`) 추가.
- 개발 서버에서 손상 데이터 백업이 여러 개 생김(StrictMode가 초기화 함수를 두 번 호출) → 같은 내용의 백업이 있으면 건너뜀.
- (테스트) Edge에서 카드를 집자마자 방향키를 누르면 키가 무시됨. dnd-kit이 드롭 대상 측정·키 리스너 등록을 비동기로 하기 때문이며 사람 속도에서는 발생하지 않는다 → E2E에서 집은 뒤 200ms 대기.

### 남은 일
- ~~Firefox·WebKit 환경에서 E2E 실행~~ → NFR-7 범위 변경으로 불필요.
- ~~`tests/e2e/_debug/probe.spec.ts` 삭제~~ → 사용자가 삭제함.
- zod 전체 import로 클라이언트 번들에 zod 로케일이 포함된다(첫 청크 약 460KB). 필요하면 `zod/mini`로 줄일 수 있다.
