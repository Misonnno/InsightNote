"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import ReactMarkdown from "react-markdown";
import { CheckCircle, XCircle, Calendar, Loader2, Trophy, Eye, Award } from "lucide-react";

// 复习间隔 (天数)
const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60];

type Note = {
  id: number;
  question: string;
  answer: string;
  image_url?: string;
  review_stage: number;
  next_review_at: string;
};

export default function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); // 当前第几题
  const [isFlipped, setIsFlipped] = useState(false); // 是否翻牌

  useEffect(() => {
    const fetchDueNotes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const now = new Date().toISOString();

      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_mastered", false) // 只查未掌握的
        .lte("next_review_at", now) // 查“到期”的
        .order("next_review_at", { ascending: true })
        .limit(50);

      if (data) setNotes(data);
      setLoading(false);
    };
    fetchDueNotes();
  }, []);

  const handleReview = async (result: "forgot" | "remembered" | "mastered") => {
    const currentNote = notes[currentIndex];
    if (!currentNote) return;

    let newStage = currentNote.review_stage;
    let nextDate = new Date(); // 获取当前时间
    let isMastered = false;

    if (result === "mastered") {
      // 😎 已掌握：踢出复习队列
      isMastered = true;
      nextDate.setFullYear(nextDate.getFullYear() + 100); 
    } else if (result === "remembered") {
      // ✅ 记得：计算间隔天数
      const intervalDays = REVIEW_INTERVALS[newStage] || 60;
      nextDate.setDate(nextDate.getDate() + intervalDays);
      
      // ✨✨✨ 核心修改：将时间强制设为当天的凌晨 04:00:00 ✨✨✨
      // 这样就实现了“按天刷新”，而不是“按24小时滚动刷新”
      nextDate.setHours(4, 0, 0, 0); 
      
      newStage += 1;
    } else {
      // ❌ 忘了：明天复习
      nextDate.setDate(nextDate.getDate() + 1);
      
      // ✨✨✨ 核心修改：同样设为明天凌晨 04:00:00 ✨✨✨
      nextDate.setHours(4, 0, 0, 0);
      
      newStage = 0;
    }

    // 1. 乐观更新 UI (立即切下一题)
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setIsFlipped(false);

    // 2. 异步更新数据库
    await supabase
      .from("notes")
      .update({
        review_stage: newStage,
        next_review_at: nextDate.toISOString(),
        is_mastered: isMastered
      })
      .eq("id", currentNote.id);

    // 撒花特效
    if (nextIndex >= notes.length && typeof window !== "undefined" && (window as any).confetti) {
      (window as any).confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  // --- 渲染部分 ---

  if (loading) return <div className="flex h-[80vh] items-center justify-center text-blue-600"><Loader2 size={40} className="animate-spin" /></div>;

  // 场景：没有待复习的题
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-green-100 p-6 rounded-full mb-6 animate-in zoom-in duration-500">
            <Trophy size={64} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">太棒了！今日任务已清空</h2>
        <p className="text-gray-500 max-w-md">所有到期的错题都已复习完毕。</p>
        <a href="/" className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">去上传新题</a>
      </div>
    );
  }

  // 场景：复习完成
  if (currentIndex >= notes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-blue-100 p-6 rounded-full mb-6 animate-bounce">
            <CheckCircle size={64} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">本次复习完成！</h2>
        <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">刷新试试</button>
      </div>
    );
  }

  const currentNote = notes[currentIndex];
  const progress = Math.round(((currentIndex) / notes.length) * 100);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 h-[calc(100vh-80px)] flex flex-col">
      
      {/* 进度条 */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>今日待复习</span>
            <span>{currentIndex + 1} / {notes.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* 卡片主体 */}
      <div className="flex-1 bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden flex flex-col relative">
         {/* 题目区 */}
         <div className="p-8 border-b bg-gradient-to-b from-white to-gray-50/50 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">阶段 {currentNote.review_stage}</span>
            </div>
            {currentNote.image_url && (
                <div className="mb-6 flex justify-center">
                    <img src={currentNote.image_url} className="max-h-48 rounded-lg shadow-sm object-contain bg-white border" alt="题目图片"/>
                </div>
            )}
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed whitespace-pre-wrap">{currentNote.question}</h2>
         </div>

         {/* 答案区 */}
         {isFlipped ? (
             <div className="flex-1 bg-blue-50/30 p-8 overflow-y-auto animate-in slide-in-from-bottom-10 fade-in duration-300">
                 <div className="flex items-center gap-2 mb-4 text-green-600 font-bold"><CheckCircle size={20} /> 解析 / Answer</div>
                 <div className="markdown-body text-gray-700"><ReactMarkdown>{currentNote.answer}</ReactMarkdown></div>
             </div>
         ) : (
             <div className="h-1/3 flex items-center justify-center bg-gray-50 border-t border-dashed border-gray-200">
                 <button onClick={() => setIsFlipped(true)} className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 shadow-sm rounded-full text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all group">
                    <Eye size={20} className="group-hover:text-blue-500" /> 显示解析 & 验证
                 </button>
             </div>
         )}
      </div>

      {/* 底部按钮组 */}
      {isFlipped && (
          <div className="mt-6 grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => handleReview("forgot")} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 active:scale-95 transition-all">
                <XCircle size={24} className="mb-1" />
                <span className="font-bold text-sm">忘了</span>
            </button>

            <button onClick={() => handleReview("remembered")} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-green-50 text-green-600 border border-green-100 hover:bg-green-100 active:scale-95 transition-all">
                <CheckCircle size={24} className="mb-1" />
                <span className="font-bold text-sm">记得</span>
            </button>

            <button onClick={() => handleReview("mastered")} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 active:scale-95 transition-all">
                <Award size={24} className="mb-1" />
                <span className="font-bold text-sm">已掌握</span>
                <span className="text-[10px] opacity-70">不再复习</span>
            </button>
          </div>
      )}
      {!isFlipped && <div className="h-[90px] mt-6"></div>}
    </div>
  );
}