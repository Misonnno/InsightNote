// frontend/app/profile/page.tsx
"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Mail, Calendar, ShieldCheck, Target, Edit2, Check, X, BarChart2, Flame } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // 签名相关的状态
  const [signature, setSignature] = useState("考研冲刺中"); 
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [tempSignature, setTempSignature] = useState("");
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  // 学习热力图相关状态
  const [heatmapData, setHeatmapData] = useState<{date: string, level: number, count: number}[]>([]);
  const [studyStats, setStudyStats] = useState({ totalDays: 0, questionsDone: 0, accuracy: 0 });

  useEffect(() => {
    const getUserAndStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      
      if (user.user_metadata?.signature) {
        setSignature(user.user_metadata.signature);
      }

      // ✨✨✨ 1. 从 notes 表拉取基础统计数据 ✨✨✨
      const { data: notes, error: notesError } = await supabase
        .from("notes")
        .select("review_stage, is_mastered")
        .eq("user_id", user.id);

      if (notes && !notesError) {
        const totalNotes = notes.length;
        
        // 累计复习(题)：只要 review_stage > 0 或者 已经掌握了，就算复习过
        const reviewedCount = notes.filter(n => n.review_stage > 0 || n.is_mastered).length;
        
        // 掌握的题目数量
        const masteredCount = notes.filter(n => n.is_mastered).length;
        
        // 计算掌握率 (百分比)
        const accuracyRate = totalNotes > 0 ? Math.round((masteredCount / totalNotes) * 100) : 0;

        // 计算加入天数
        const joinDate = new Date(user.created_at);
        const daysSinceJoin = Math.max(1, Math.floor((Date.now() - joinDate.getTime()) / (1000 * 3600 * 24)));

        setStudyStats({ 
          totalDays: daysSinceJoin, 
          questionsDone: reviewedCount, 
          accuracy: accuracyRate 
        });
      }

      // ✨✨✨ 2. 从 study_logs 表拉取最近 30 天的热力图真实打卡数据 ✨✨✨
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 29);
      const startDateStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;

      const { data: logs, error: logsError } = await supabase
        .from("study_logs")
        .select("action_date, questions_reviewed")
        .eq("user_id", user.id)
        .gte("action_date", startDateStr);

      if (!logsError) {
        // 把数据库拉回来的数据，整理成 30 个格子的数组
        const realHeatmapData = Array.from({ length: 30 }, (_, i) => {
          // 计算对应的日期 (避免时区问题，手动拼接 YYYY-MM-DD)
          const d = new Date(today.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          
          // 查找这一天的打卡记录
          const log = logs?.find(l => l.action_date === dateStr);
          const count = log ? log.questions_reviewed : 0;
          
          // 活跃度分级 (0-4级，可根据你的刷题强度自行调整阈值)
          let level = 0;
          if (count > 0 && count <= 5) level = 1;       // 1-5题
          else if (count > 5 && count <= 15) level = 2; // 6-15题
          else if (count > 15 && count <= 30) level = 3;// 16-30题
          else if (count > 30) level = 4;               // >30题

          return {
            date: dateStr,
            level: level,
            count: count
          };
        });

        setHeatmapData(realHeatmapData);
      }
    };

    getUserAndStats();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

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

  const getHeatmapColor = (level: number) => {
    const colors = ['bg-gray-100', 'bg-green-200', 'bg-green-400', 'bg-green-500', 'bg-green-700'];
    return colors[level] || colors[0];
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
    <div className="max-w-2xl mx-auto p-6 md:p-8 min-h-[calc(100vh-64px)] pb-20">
      <h1 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
        <UserIcon className="text-blue-500" /> 个人中心
      </h1>

      <div className="space-y-6">
        {/* --- 模块一：个人基本信息 --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                      <button onClick={saveSignature} disabled={isSavingSignature} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50" title="保存">
                        <Check size={16} />
                      </button>
                      <button onClick={cancelEditing} className="p-1.5 text-gray-400 hover:bg-gray-50 hover:text-red-500 rounded-md transition-colors" title="取消">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-2 w-fit cursor-pointer" onClick={startEditing}>
                      <div className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-md transition-colors group-hover:bg-blue-100 border border-transparent group-hover:border-blue-200">
                        <Target size={14} />
                        <span>{signature}</span>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-blue-500 p-1 rounded-md" title="修改签名">
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex items-center gap-4 text-gray-600 border-b border-gray-50 pb-4">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><Mail size={18} /></div>
                <div><p className="text-sm text-gray-400 font-medium">注册邮箱</p><p className="text-gray-800">{email}</p></div>
              </div>
              <div className="flex items-center gap-4 text-gray-600 border-b border-gray-50 pb-4">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><Calendar size={18} /></div>
                <div><p className="text-sm text-gray-400 font-medium">加入时间</p><p className="text-gray-800">{createdAt}</p></div>
              </div>
              <div className="flex items-center gap-4 text-gray-600">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><ShieldCheck size={18} /></div>
                <div><p className="text-sm text-gray-400 font-medium">账号状态</p><p className="text-green-600 font-medium text-sm flex items-center gap-1">正常使用中</p></div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 模块二：学习数据看板 & 热力图 --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart2 className="text-indigo-500" /> 学习数据看板
          </h3>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-orange-50 p-4 rounded-xl text-center border border-orange-100">
              <div className="flex justify-center mb-1"><Flame size={20} className="text-orange-500"/></div>
              <p className="text-2xl font-bold text-orange-600">{studyStats.totalDays}</p>
              <p className="text-xs text-gray-500 mt-1">加入天数</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100">
              <div className="flex justify-center mb-1"><Target size={20} className="text-blue-500"/></div>
              <p className="text-2xl font-bold text-blue-600">{studyStats.questionsDone}</p>
              <p className="text-xs text-gray-500 mt-1">累计复习(题)</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center border border-green-100">
              <div className="flex justify-center mb-1"><ShieldCheck size={20} className="text-green-500"/></div>
              <p className="text-2xl font-bold text-green-600">{studyStats.accuracy}%</p>
              <p className="text-xs text-gray-500 mt-1">掌握率</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500 font-medium mb-3">最近 30 天活跃度</p>
            <div className="flex gap-1.5 flex-wrap">
              {heatmapData.map((day, index) => (
                <div 
                  key={index} 
                  className={`w-6 h-6 rounded-[4px] ${getHeatmapColor(day.level)} transition-all duration-200 hover:scale-110 hover:shadow-md cursor-pointer`}
                  title={`${day.date}: 复习了 ${day.count} 题`}
                ></div>
              ))}
            </div>
            <div className="flex justify-end items-center mt-3 text-xs text-gray-400 gap-1.5">
              <span>少</span>
              <div className="w-3 h-3 rounded-[3px] bg-gray-100"></div>
              <div className="w-3 h-3 rounded-[3px] bg-green-200"></div>
              <div className="w-3 h-3 rounded-[3px] bg-green-400"></div>
              <div className="w-3 h-3 rounded-[3px] bg-green-500"></div>
              <div className="w-3 h-3 rounded-[3px] bg-green-700"></div>
              <span>多</span>
            </div>
          </div>
        </div>

        {/* 退出按钮 */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-medium rounded-xl transition-colors"
          >
            <LogOut size={18} /> 退出登录
          </button>
        </div>
      </div>
    </div>
  );
}