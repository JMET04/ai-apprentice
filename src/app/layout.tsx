import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "明徒 AI - 可教、可纠错、可追踪的智能学徒",
  description: "通过文字、示范与蒙版纠错训练智能学徒，并把审核后的包装方案衔接到 CAD 工程图。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
