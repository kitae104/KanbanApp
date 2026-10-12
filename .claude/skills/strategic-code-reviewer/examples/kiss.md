# KISS (Keep It Simple, Stupid) 원칙

> 출처: `src/server/board/queries.ts` (moveCard)

## Bad: 중첩 루프 + 평행 배열 3개를 손으로 채움
- 문제: `for` 안의 `forEach`에서 `ids`/`statuses`/`positions`를 각각 push. 세 배열의 길이·순서가 맞아야 한다는 규칙이 코드에 드러나지 않음
- 영향: push 하나를 빼먹으면 `unnest`가 엉뚱한 행을 만들고, 같은 파일의 `importBoard`는 `flatMap`을 쓰므로 방식도 일관되지 않음

```typescript
const affected = new Set<Status>([fromStatus, toStatus]);
const ids: string[] = [];
const statuses: Status[] = [];
const positions: number[] = [];
for (const status of affected) {
  next.columns[status].forEach((cardId, position) => {
    ids.push(cardId);
    statuses.push(status);
    positions.push(position);
  });
}
```

## Good: 행 객체를 한 번 만들고 컬럼별로 뽑기
- 개선: `flatMap`으로 행을 만들고 `map`으로 배열 추출 (변경 가능한 상태·중첩 제거)
- 효과: 행 하나가 (id, status, position)이라는 단위가 명확하고, `importBoard`와 같은 방식이 됨

```typescript
const rows = [...new Set<Status>([fromStatus, toStatus])].flatMap((status) =>
  next.columns[status].map((id, position) => ({ id, status, position })),
);
const ids = rows.map((row) => row.id);
const statuses = rows.map((row) => row.status);
const positions = rows.map((row) => row.position);
```
