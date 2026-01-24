import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar"; // 👈 引入导航栏

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InsightNote - 智能错题本",
  description: "基于 AI 的错题管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className={`${inter.className} bg-gray-50`}>
        {/* 👇 把 Navbar 放在 children 上面 */}
        <Navbar /> 
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}