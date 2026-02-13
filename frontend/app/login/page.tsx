"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../../supabase"; // 引入我们的连接器
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Login() {
  const router = useRouter();

  // 监听登录状态：如果用户登录成功了，就自动踢到首页去
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          router.push("/"); // 跳转到主页
        }
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">InsightNote 🧠</h1>
        <p className="text-gray-500 mb-8">请登录你的智能错题本</p>
        
        {/* Supabase 官方提供的超强登录组件 */}
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }} // 使用默认漂亮主题
          providers={[]} // 我们暂时只用邮箱密码，不搞第三方
          localization={{
            variables: {
              sign_in: {
                email_label: "邮箱地址",
                password_label: "密码",
                button_label: "直接登录",
              },
              sign_up: {
                 email_label: "邮箱地址",
                 password_label: "密码",
                 button_label: "注册新账号",
              }
              // 如果你想汉化更多，可以查文档，这里先简单汉化几个
            },
          }}
        />
      </div>
    </main>
  );
}