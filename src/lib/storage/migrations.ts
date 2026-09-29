import { STORAGE_VERSION } from "@/lib/board/schema";

type VersionedData = Record<string, unknown> & { version: number };

/** 키 n의 함수는 v(n) 데이터를 v(n+1)로 올린다. 스키마가 바뀌면 여기에 추가한다. */
const MIGRATIONS: Record<number, (data: VersionedData) => VersionedData> = {};

function isVersioned(data: unknown): data is VersionedData {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { version?: unknown }).version === "number"
  );
}

/** 저장 데이터를 현재 버전으로 올린다. 올릴 수 없으면 null을 돌려준다. */
export function migrate(data: unknown): unknown {
  if (!isVersioned(data)) return null;
  let current = data;
  while (current.version < STORAGE_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step) return null;
    current = step(current);
  }
  return current.version === STORAGE_VERSION ? current : null;
}
