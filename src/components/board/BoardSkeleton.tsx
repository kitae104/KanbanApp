import { STATUSES } from "@/lib/board/types";

/** 저장소를 읽기 전(서버 렌더·hydration)에 보여주는 자리표시자. */
export function BoardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="보드를 불러오는 중"
      className="flex gap-4 overflow-hidden lg:grid lg:grid-cols-3"
    >
      {STATUSES.map((status) => (
        <div
          key={status}
          className="h-[calc(100dvh-10rem-1px)] min-h-80 w-[85vw] shrink-0 animate-pulse rounded-xl bg-column sm:w-80 lg:w-auto"
        />
      ))}
    </div>
  );
}
