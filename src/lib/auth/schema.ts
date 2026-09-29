import { z } from "zod";

// 가입·로그인 입력 규칙 (spec FR-1, FR-2). 클라이언트 폼과 서버 액션이 같이 쓴다.
// zod JIT 비활성화(CSP)는 @/lib/board/schema에서 이미 전역으로 설정한다.
import "@/lib/board/schema";

export const PASSWORD_MIN = 8;
/** bcrypt 입력 한계와 맞춘 상한. argon2에는 한계가 없지만 명세를 따른다 (plan §2). */
export const PASSWORD_MAX_BYTES = 72;

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("올바른 이메일 주소를 입력하세요.").max(254, "이메일이 너무 깁니다."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `패스워드는 ${PASSWORD_MIN}자 이상이어야 합니다.`)
  .refine((value) => utf8Length(value) <= PASSWORD_MAX_BYTES, {
    message: `패스워드가 너무 깁니다(최대 ${PASSWORD_MAX_BYTES}바이트).`,
  });

export const signupSchema = z
  .object({ email: emailSchema, password: passwordSchema, passwordConfirm: z.string() })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "패스워드가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

/** 로그인은 길이 규칙을 보지 않는다. 어떤 오류든 같은 메시지로 답해야 하기 때문이다 (FR-6). */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "패스워드를 입력하세요."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthField = "email" | "password" | "passwordConfirm";
export type FieldErrors = Partial<Record<AuthField, string>>;

/** zod 오류를 필드별 첫 메시지로 바꾼다. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as AuthField | undefined;
    if (field && !result[field]) result[field] = issue.message;
  }
  return result;
}
