"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, BookOpen, Network, CalendarCheck, LogOut, Star } from "lucide-react";
import { supabase } from "../../supabase";

export default function Navbar() {
  const pathname = usePathname(); 
  const router = useRouter();

  // 1. 如果在登录页，直接不渲染导航栏
  if (pathname === "/login") {
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 定义导航项
  const navItems = [
    { name: "上传错题", href: "/", icon: <Home size={20} /> },
    { name: "错题库", href: "/library", icon: <BookOpen size={20} /> },
    { name: "收藏夹", href: "/collections", icon: <Star size={20} /> },
    { name: "知识星云", href: "/graph", icon: <Network size={20} /> },
    { name: "今日复习", href: "/review", icon: <CalendarCheck size={20} /> },
  ];

  return (
    <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <Link href="/">InsightNote 🧠</Link>
        </div>

        {/* 中间导航按钮 */}
        <div className="flex gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.icon}
                <span className="hidden md:block">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* 右侧退出按钮 */}
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="退出登录"
        >
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}