import { BoardSkeleton } from "@/components/board/BoardSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-ink">칸반 보드</h1>
      <BoardSkeleton />
    </main>
  );
}
