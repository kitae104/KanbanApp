import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "@/app/(auth)/actions";
import { AuthForm, type FieldSpec } from "@/components/auth/AuthForm";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { loginSchema, signupSchema } from "@/lib/auth/schema";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const SIGNUP_FIELDS: FieldSpec[] = [
  { name: "email", label: "이메일", type: "email", autoComplete: "email" },
  { name: "password", label: "패스워드", type: "password", autoComplete: "new-password" },
  { name: "passwordConfirm", label: "패스워드 확인", type: "password", autoComplete: "new-password" },
];
const LOGIN_FIELDS: FieldSpec[] = [
  { name: "email", label: "이메일", type: "email", autoComplete: "email" },
  { name: "password", label: "패스워드", type: "password", autoComplete: "current-password" },
];

function renderForm(
  action: (state: AuthFormState, data: FormData) => Promise<AuthFormState>,
  kind: "login" | "signup" = "signup",
) {
  const user = userEvent.setup();
  render(
    <AuthForm
      title={kind === "login" ? "로그인" : "회원가입"}
      submitLabel={kind === "login" ? "로그인" : "가입하기"}
      fields={kind === "login" ? LOGIN_FIELDS : SIGNUP_FIELDS}
      schema={kind === "login" ? loginSchema : signupSchema}
      action={action}
      footer={{ text: "", href: "/login", link: "로그인" }}
    />,
  );
  return user;
}

describe("AuthForm", () => {
  it("모든 입력이 레이블로 연결되고 자동완성 속성이 있다 (NFR-12, 14)", () => {
    renderForm(vi.fn());
    expect(screen.getByLabelText("이메일")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("패스워드")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("패스워드 확인")).toHaveAttribute("type", "password");
  });

  it("브라우저에서 먼저 검사해 오류를 보여주고 첫 오류 필드로 포커스를 옮긴다", async () => {
    const action = vi.fn();
    const user = renderForm(action);
    await user.type(screen.getByLabelText("이메일"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "가입하기" }));

    const email = screen.getByLabelText("이메일");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription("올바른 이메일 주소를 입력하세요.");
    expect(action).not.toHaveBeenCalled();
  });

  it("서버 오류 메시지를 alert로 알린다 (FR-6)", async () => {
    const action = vi.fn(async () => ({
      formError: AUTH_MESSAGES.loginFailed,
      email: "a@test.local",
    }));
    const user = renderForm(action, "login");
    await user.type(screen.getByLabelText("이메일"), "a@test.local");
    await user.type(screen.getByLabelText("패스워드"), "wrong");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(AUTH_MESSAGES.loginFailed);
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("이메일")).toHaveValue("a@test.local");
  });

  it("서버가 준 필드 오류를 해당 입력에 연결한다 (FR-5)", async () => {
    const action = vi.fn(async () => ({
      fieldErrors: { email: AUTH_MESSAGES.emailTaken },
      email: "a@test.local",
    }));
    const user = renderForm(action);
    await user.type(screen.getByLabelText("이메일"), "a@test.local");
    await user.type(screen.getByLabelText("패스워드"), "password1");
    await user.type(screen.getByLabelText("패스워드 확인"), "password1");
    await user.click(screen.getByRole("button", { name: "가입하기" }));

    expect(await screen.findByText(AUTH_MESSAGES.emailTaken)).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toHaveFocus();
  });

  it("패스워드 보기 토글로 입력 형식을 바꾼다", async () => {
    const user = renderForm(vi.fn(), "login");
    const password = screen.getByLabelText("패스워드");
    const toggle = screen.getByRole("button", { name: "패스워드 보기" });
    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "패스워드 숨기기" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
