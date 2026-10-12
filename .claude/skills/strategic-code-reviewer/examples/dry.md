# DRY (Don't Repeat Yourself) 원칙

> 출처: `src/server/board/queries.ts` (getBoard / addCard / updateCard)

## Bad: 같은 컬럼 목록이 SQL마다 반복됨
- 문제: `id, title, description, status, position, created_at, updated_at`가 3개 쿼리에 복사됨
- 영향: 카드에 컬럼을 추가하면 3곳 + `CardRow` 타입을 모두 고쳐야 하고, 한 곳을 빼먹으면 `rowToCard`가 런타임에 깨짐

```typescript
export async function getBoard(boardId: string, db: Queryable = getPool()) {
  const { rows } = await db.query<CardRow>(
    `SELECT id, title, description, status, position, created_at, updated_at
       FROM cards WHERE board_id = $1 ORDER BY status, position`,
    [boardId],
  );
  return rowsToBoard(rows);
}

// addCard
`INSERT INTO cards (...) SELECT ... ON CONFLICT (id) DO NOTHING
 RETURNING id, title, description, status, position, created_at, updated_at`

// updateCard
`UPDATE cards SET title = $3, description = $4, updated_at = now()
  WHERE id = $1 AND board_id = $2
  RETURNING id, title, description, status, position, created_at, updated_at`
```

## Good: 컬럼 목록을 `CardRow`와 한 곳에 정의
- 개선: `rowsToBoard.ts`에 상수 하나를 두고 모든 쿼리가 참조
- 효과: 컬럼 변경 지점이 `CardRow` 타입 바로 옆 한 곳으로 모임 (상수는 리터럴이라 SQL 인젝션 위험 없음)

```typescript
// server/board/rowsToBoard.ts — CardRow 타입 바로 옆
export const CARD_COLUMNS = "id, title, description, status, position, created_at, updated_at";

// server/board/queries.ts
`SELECT ${CARD_COLUMNS} FROM cards WHERE board_id = $1 ORDER BY status, position`
`... RETURNING ${CARD_COLUMNS}`
```
