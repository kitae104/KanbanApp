"use client";

import { signup } from "@/app/(auth)/actions";
import { PASSWORD_MIN, signupSchema } from "@/lib/auth/schema";
import { AuthForm } from "./AuthForm";

export function SignupForm() {
  return (
    <AuthForm
      title="회원가입"
      submitLabel="가입하기"
      action={signup}
      schema={signupSchema}
      fields={[
        { name: "email", label: "이메일", type: "email", autoComplete: "email" },
        {
          name: "password",
          label: "패스워드",
          type: "password",
          autoComplete: "new-password",
          hint: `${PASSWORD_MIN}자 이상`,
        },
        {
          name: "passwordConfirm",
          label: "패스워드 확인",
          type: "password",
          autoComplete: "new-password",
        },
      ]}
      footer={{ text: "이미 계정이 있나요?", href: "/login", link: "로그인" }}
    />
  );
}
