import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "칸반 보드",
  description: "할 일, 진행 중, 완료 3단계로 작업을 관리하는 칸반 보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
