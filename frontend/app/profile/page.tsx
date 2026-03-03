"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Mail, Calendar, ShieldCheck, Target, Edit2, Check, X } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // 签名相关的状态
  const [signature, setSignature] = useState("考研冲刺中"); // 默认签名
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [tempSignature, setTempSignature] = useState("");
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      
      // 如果用户之前保存过自定义签名，就用保存的，否则用默认的
      if (user.user_metadata?.signature) {
        setSignature(user.user_metadata.signature);
      }
    };
    getUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 保存新签名到 Supabase 的 user_metadata 中
  const saveSignature = async () => {
    const newSig = tempSignature.trim();
    if (!newSig) {
      alert("签名不能为空哦！");
      return;
    }

    setIsSavingSignature(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { signature: newSig }
    });

    if (error) {
      alert("保存失败: " + error.message);
    } else {
      setSignature(newSig);
      setIsEditingSignature(false);
    }
    setIsSavingSignature(false);
  };

  const startEditing = () => {
    setTempSignature(signature);
    setIsEditingSignature(true);
  };

  const cancelEditing = () => {
    setIsEditingSignature(false);
    setTempSignature("");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="animate-pulse text-gray-400">正在加载个人信息...</div>
      </div>
    );
  }

  const email = user.email;
  const createdAt = new Date(user.created_at).toLocaleDateString();
  const displayName = user.user_metadata?.full_name || "Misonnno";

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
        <UserIcon className="text-blue-500" /> 个人中心
      </h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 顶部背景图/渐变色 */}
        <div className="h-32 bg-gradient-to-r from-blue-400 to-indigo-500 relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md border-4 border-white text-blue-500 text-4xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="pt-16 pb-8 px-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{displayName}</h2>
              
              {/* 可编辑的动态签名区域 */}
              <div className="mt-2 h-8 flex items-center">
                {isEditingSignature ? (
                  <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <input
                      type="text"
                      value={tempSignature}
                      onChange={(e) => setTempSignature(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveSignature()}
                      placeholder="输入新签名..."
                      maxLength={20}
                      className="border border-blue-200 rounded-md px-2 py-1 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 w-40 transition-all shadow-inner"
                      autoFocus
                    />
                    <button 
                      onClick={saveSignature} 
                      disabled={isSavingSignature}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                      title="保存"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={cancelEditing} 
                      className="p-1.5 text-gray-400 hover:bg-gray-50 hover:text-red-500 rounded-md transition-colors"
                      title="取消"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-2 w-fit cursor-pointer" onClick={startEditing}>
                    <div className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-md transition-colors group-hover:bg-blue-100 border border-transparent group-hover:border-blue-200">
                      <Target size={14} />
                      <span>{signature}</span>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-blue-500 p-1 rounded-md"
                      title="修改签名"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="space-y-6 mt-8">
            <div className="flex items-center gap-4 text-gray-600 border-b border-gray-50 pb-4">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">注册邮箱</p>
                <p className="text-gray-800">{email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-gray-600 border-b border-gray-50 pb-4">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">加入时间</p>
                <p className="text-gray-800">{createdAt}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-gray-600">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">账号状态</p>
                <p className="text-green-600 font-medium text-sm flex items-center gap-1">
                  正常使用中
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-medium rounded-xl transition-colors"
            >
              <LogOut size={18} />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}