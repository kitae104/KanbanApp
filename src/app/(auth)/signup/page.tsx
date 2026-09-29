import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "회원가입 · 칸반 보드" };

export default function SignupPage() {
  return <SignupForm />;
}
