import { logout } from "@/app/(auth)/actions";
import { BUTTON_BASE } from "@/components/board/styles";

/** 로그인한 유저의 이메일과 로그아웃 버튼 (FR-10). */
export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-line bg-surface">
      {/* 높이 3rem + 테두리 1px. 컬럼 높이(100dvh-10rem-1px)가 이 값을 빼고 계산한다. */}
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center justify-end gap-3 px-4">
        <p className="min-w-0 truncate text-sm text-muted">
          <span className="sr-only">로그인한 계정: </span>
          <span data-testid="current-user">{email}</span>
        </p>
        <form action={logout}>
          <button
            type="submit"
            className={`${BUTTON_BASE} border border-line text-ink hover:bg-column`}
          >
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}
