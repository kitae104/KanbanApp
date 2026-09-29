import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_BYTES,
  emailSchema,
  loginSchema,
  passwordSchema,
  signupSchema,
} from "@/lib/auth/schema";

describe("emailSchema", () => {
  it("앞뒤 공백을 지우고 소문자로 바꾼다", () => {
    expect(emailSchema.parse("  User@Test.Local ")).toBe("user@test.local");
  });

  it.each([["빈 문자열", ""], ["@ 없음", "user.test"], ["255자", `${"a".repeat(245)}@test.local`]])(
    "%s은 거부한다",
    (_, value) => {
      expect(emailSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("passwordSchema", () => {
  it("7자는 거부하고 8자는 허용한다", () => {
    expect(passwordSchema.safeParse("a".repeat(7)).success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(8)).success).toBe(true);
  });

  it("UTF-8 72바이트까지 허용한다 (한글 24자 = 72바이트)", () => {
    expect(PASSWORD_MAX_BYTES).toBe(72);
    expect(passwordSchema.safeParse("가".repeat(24)).success).toBe(true);
    expect(passwordSchema.safeParse("가".repeat(25)).success).toBe(false);
  });

  it("앞뒤 공백을 지우지 않는다", () => {
    expect(passwordSchema.parse(" pass word ")).toBe(" pass word ");
  });
});

describe("signupSchema", () => {
  const valid = { email: "a@test.local", password: "password1", passwordConfirm: "password1" };

  it("패스워드 확인이 다르면 passwordConfirm 필드 오류를 준다", () => {
    const result = signupSchema.safeParse({ ...valid, passwordConfirm: "password2" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["passwordConfirm"]);
  });

  it("올바른 입력은 정규화된 이메일로 통과한다", () => {
    expect(signupSchema.parse({ ...valid, email: " A@Test.local" }).email).toBe("a@test.local");
  });
});

describe("loginSchema", () => {
  it("패스워드 길이 규칙을 검사하지 않는다(기존 계정 오류를 통일하기 위해)", () => {
    expect(loginSchema.safeParse({ email: "a@test.local", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@test.local", password: "" }).success).toBe(false);
  });
});
