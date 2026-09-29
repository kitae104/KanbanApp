import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "로그인 · 칸반 보드" };

export default function LoginPage() {
  return <LoginForm />;
}
