import { normalizeBoard } from "@/lib/board/operations";
import { STORAGE_VERSION, storedBoardSchema, type StoredBoard } from "@/lib/board/schema";
import type { BoardState } from "@/lib/board/types";
import type { BoardRepository, LoadResult, SaveResult } from "./boardRepository";
import { migrate } from "./migrations";

export const STORAGE_KEY = "kanban-app:board";

const QUOTA_ERROR_NAMES = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);

function toSaveError(error: unknown): Extract<SaveResult, { ok: false }>["error"] {
  if (error instanceof DOMException) {
    if (QUOTA_ERROR_NAMES.has(error.name)) return "quota";
    if (error.name === "SecurityError") return "unavailable";
  }
  return "unknown";
}

const BACKUP_PREFIX = `${STORAGE_KEY}:corrupt-`;

/**
 * 저장 형식이 달라 읽을 수 없는 원본을 별도 키에 남겨 둔다 (plan §4.2).
 * 개발 모드 StrictMode처럼 load가 여러 번 불려도 같은 원본은 한 번만 백업한다.
 */
function backupCorrupt(storage: Storage, raw: string) {
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(BACKUP_PREFIX) && storage.getItem(key) === raw) return;
    }
    storage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw);
  } catch {
    // 백업도 실패하면 원본은 다음 저장 때 덮어써진다.
  }
  console.warn(`[kanban] ${STORAGE_KEY}의 저장 데이터를 읽을 수 없어 빈 보드로 시작합니다.`);
}

export function createLocalStorageBoardRepository(
  getStorage: () => Storage = () => window.localStorage,
): BoardRepository {
  return {
    load(): LoadResult {
      let storage: Storage;
      let raw: string | null;
      try {
        storage = getStorage();
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        return { ok: false, reason: "unavailable" };
      }
      if (raw === null) return { ok: false, reason: "empty" };

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        backupCorrupt(storage, raw);
        return { ok: false, reason: "corrupt" };
      }
      const result = storedBoardSchema.safeParse(migrate(parsed));
      if (!result.success) {
        backupCorrupt(storage, raw);
        return { ok: false, reason: "corrupt" };
      }
      return { ok: true, board: normalizeBoard(result.data.board) };
    },

    save(board: BoardState): SaveResult {
      const payload: StoredBoard = {
        version: STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        board,
      };
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(payload));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toSaveError(error) };
      }
    },
  };
}

export const localStorageBoardRepository = createLocalStorageBoardRepository();
