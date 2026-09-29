import { describe, expect, it } from "vitest";
import { migrate } from "@/lib/storage/migrations";

describe("migrate", () => {
  it("현재 버전 데이터는 그대로 돌려준다", () => {
    const data = { version: 1, savedAt: "x", board: {} };
    expect(migrate(data)).toBe(data);
  });

  it("알 수 없는 버전·형식이면 null", () => {
    expect(migrate({ version: 99 })).toBeNull();
    expect(migrate({ version: 0 })).toBeNull();
    expect(migrate({ board: {} })).toBeNull();
    expect(migrate("text")).toBeNull();
    expect(migrate(null)).toBeNull();
  });
});
