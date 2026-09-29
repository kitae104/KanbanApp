"use client";

import { login } from "@/app/(auth)/actions";
import { loginSchema } from "@/lib/auth/schema";
import { AuthForm } from "./AuthForm";

export function LoginForm() {
  return (
    <AuthForm
      title="로그인"
      submitLabel="로그인"
      action={login}
      schema={loginSchema}
      fields={[
        { name: "email", label: "이메일", type: "email", autoComplete: "email" },
        { name: "password", label: "패스워드", type: "password", autoComplete: "current-password" },
      ]}
      footer={{ text: "계정이 없나요?", href: "/signup", link: "회원가입" }}
    />
  );
}
