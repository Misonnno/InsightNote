// frontend/app/review/page.tsx
"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { CheckCircle, XCircle, Loader2, Trophy, Eye, EyeOff, Award, Sparkles, RefreshCw, Edit3, Save } from "lucide-react";

const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60];

type Note = {
  id: number;
  question: string;
  answer: string;
  image_url?: string;
  review_stage: number;
  next_review_at: string;
  user_note?: string; // ✨ 新增：用户笔记字段
};

export default function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0); 
  const [isFlipped, setIsFlipped] = useState(false); 
  const [userId, setUserId] = useState<string | null>(null);

  // --- 举一反三相关状态 ---
  const [autoGenerateSimilar, setAutoGenerateSimilar] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQA, setGeneratedQA] = useState<{question: string, answer: string} | null>(null);
  const [showGeneratedAnswer, setShowGeneratedAnswer] = useState(false); 

  // --- 笔记/批注相关状态 ---
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempNoteText, setTempNoteText] = useState("");

  useEffect(() => {
    const fetchDueNotes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      setUserId(session.user.id);

      const now = new Date().toISOString();

      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_mastered", false)
        .lte("next_review_at", now)
        .order("next_review_at", { ascending: true })
        .limit(50);

      if (data) setNotes(data);
      setLoading(false);
    };
    fetchDueNotes();
  }, []);

  useEffect(() => {
    if (isFlipped && autoGenerateSimilar) {
       handleGenerateSimilar();
    }
  }, [currentIndex, isFlipped]);

  // ✨ 保存笔记功能
  const handleSaveNote = async () => {
    const currentNote = notes[currentIndex];
    if (!currentNote) return;

    const { error } = await supabase
      .from("notes")
      .update({ user_note: tempNoteText })
      .eq("id", currentNote.id);

    if (error) {
      alert("保存笔记失败：" + error.message);
    } else {
      const updatedNotes = [...notes];
      updatedNotes[currentIndex].user_note = tempNoteText;
      setNotes(updatedNotes);
      setIsEditingNote(false);
    }
  };

  const handleGenerateSimilar = async () => {
    setIsGenerating(true);
    setGeneratedQA(null);
    setShowGeneratedAnswer(false);
    
    const currentNote = notes[currentIndex];
    if (!currentNote) {
        setIsGenerating(false);
        return;
    }

    try {
      const prompt = `请作为一名资深教师，根据以下这道题的核心考点，为我出一道“举一反三”的变式题。
要求：
1. 题目背景或数据与原题不同，但考察的核心知识点相同。
2. 请提供变式题的完整题目、深度解析和最终答案。
3. 其中的数学公式请使用严格的 LaTeX 格式（使用 $ 或 $$ 包裹）。

原题内容如下：
${currentNote.question}`;

      const response = await fetch("http://localhost:8000/ask_ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, existing_tags: "" }),
      });

      if (!response.ok) throw new Error("网络响应异常");
      const textResponse = await response.text();

      const splitMatch = textResponse.match(/#+\s*深度解析|#+\s*解析|\*\*深度解析\*\*|\*\*解析\*\*/);
      let qPart = textResponse;
      let aPart = "";

      if (splitMatch) {
        const splitIndex = textResponse.indexOf(splitMatch[0]);
        qPart = textResponse.substring(0, splitIndex).trim();
        aPart = textResponse.substring(splitIndex).trim();
      } else {
        qPart = textResponse;
        aPart = "⚠️ AI 未明确使用 Markdown 标题区分解析，请参考上方完整内容。";
      }

      setGeneratedQA({ question: qPart, answer: aPart });
    } catch (error) {
      setGeneratedQA({
        question: "【生成失败】",
        answer: "请求后端 API 失败，请检查你的后端服务是否运行正常。"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReview = async (result: "forgot" | "remembered" | "mastered") => {
    const currentNote = notes[currentIndex];
    if (!currentNote) return;

    let newStage = currentNote.review_stage;
    let nextDate = new Date();
    let isMastered = false;

    if (result === "mastered") {
      isMastered = true;
      nextDate.setFullYear(nextDate.getFullYear() + 100); 
    } else if (result === "remembered") {
      const intervalDays = REVIEW_INTERVALS[newStage] || 60;
      nextDate.setDate(nextDate.getDate() + intervalDays);
      nextDate.setHours(4, 0, 0, 0); 
      newStage += 1;
    } else {
      nextDate.setDate(nextDate.getDate() + 1);
      nextDate.setHours(4, 0, 0, 0);
      newStage = 0;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setIsFlipped(false);
    
    // 切换下一题时，重置所有状态
    setGeneratedQA(null); 
    setShowGeneratedAnswer(false);
    setIsEditingNote(false);

    const { error } = await supabase 
      .from("notes")
      .update({
        review_stage: newStage,
        next_review_at: nextDate.toISOString(),
        is_mastered: isMastered
      })
      .eq("id", currentNote.id);

    if (userId && !error) {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const { data: logData } = await supabase
        .from("study_logs")
        .select("questions_reviewed")
        .eq("user_id", userId)
        .eq("action_date", today)
        .single();

      let newCount = 1;
      if (logData) newCount = logData.questions_reviewed + 1; 

      await supabase
        .from("study_logs")
        .upsert({ user_id: userId, action_date: today, questions_reviewed: newCount }, { onConflict: 'user_id, action_date' });
    }

    if (nextIndex >= notes.length && typeof window !== "undefined" && (window as any).confetti) {
      (window as any).confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  if (loading) return <div className="flex h-[80vh] items-center justify-center text-blue-600"><Loader2 size={40} className="animate-spin" /></div>;

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-green-100 p-6 rounded-full mb-6 animate-in zoom-in duration-500"><Trophy size={64} className="text-green-600" /></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">太棒了！今日任务已清空</h2>
        <a href="/" className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">去上传新题</a>
      </div>
    );
  }

  if (currentIndex >= notes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-blue-100 p-6 rounded-full mb-6 animate-bounce"><CheckCircle size={64} className="text-blue-600" /></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">本次复习完成！</h2>
        <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">刷新试试</button>
      </div>
    );
  }

  const currentNote = notes[currentIndex];
  const progress = Math.round(((currentIndex) / notes.length) * 100);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 h-[calc(100vh-80px)] flex flex-col">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm text-gray-500 mb-1">
            <span className="font-medium text-gray-700">今日待复习 ({currentIndex + 1} / {notes.length})</span>
            <label className="flex items-center cursor-pointer gap-2 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
              <span className="text-xs font-bold text-purple-600 flex items-center gap-1"><Sparkles size={14}/> 自动举一反三</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={autoGenerateSimilar} onChange={() => setAutoGenerateSimilar(!autoGenerateSimilar)}/>
                <div className={`block w-8 h-4 rounded-full transition-colors ${autoGenerateSimilar ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-0.5 top-0.5 bg-white w-3 h-3 rounded-full transition-transform ${autoGenerateSimilar ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden flex flex-col relative">
         <div className="p-8 border-b bg-gradient-to-b from-white to-gray-50/50 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">阶段 {currentNote.review_stage}</span>
            </div>
            {currentNote.image_url && (
                <div className="mb-6 flex justify-center">
                    <img src={currentNote.image_url} className="max-h-48 rounded-lg shadow-sm object-contain bg-white border" alt="题目图片"/>
                </div>
            )}
            <div className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed whitespace-pre-wrap markdown-body">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentNote.question}</ReactMarkdown>
            </div>
         </div>

         {isFlipped ? (
             <div className="flex-1 p-8 overflow-y-auto animate-in slide-in-from-bottom-10 fade-in duration-300 bg-blue-50/30">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-green-600 font-bold">
                        <CheckCircle size={20} /> 解析 / Answer
                    </div>
                    <button onClick={() => setIsFlipped(false)} className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white/50 px-3 py-1.5 rounded-full hover:bg-white hover:text-blue-600 transition-colors shadow-sm">
                        <EyeOff size={14}/> 收起
                    </button>
                 </div>
                 <div className="markdown-body text-gray-700 mb-8">
                   <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentNote.answer}</ReactMarkdown>
                 </div>

                 {/* ✨✨✨ 新增：我的笔记模块 ✨✨✨ */}
                 <div className="mb-8 bg-yellow-50/50 border border-yellow-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-yellow-700 font-bold">
                            <Edit3 size={18} /> 我的笔记 / 批注
                        </div>
                        {!isEditingNote && (
                            <button 
                              onClick={() => {
                                setTempNoteText(currentNote.user_note || "");
                                setIsEditingNote(true);
                              }} 
                              className="text-yellow-600 hover:text-yellow-800 text-sm font-medium flex items-center gap-1 bg-yellow-100/50 px-3 py-1 rounded-full transition-colors"
                            >
                                <Edit3 size={14}/> {currentNote.user_note ? "编辑笔记" : "添加笔记"}
                            </button>
                        )}
                    </div>
                    
                    {isEditingNote ? (
                        <div className="flex flex-col gap-3 animate-in fade-in">
                            <textarea
                                value={tempNoteText}
                                onChange={(e) => setTempNoteText(e.target.value)}
                                className="w-full p-4 border border-yellow-300 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-[120px] resize-y shadow-inner"
                                placeholder="在这里写下你的解题思路、易错点提醒、公式推理..."
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsEditingNote(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl font-medium transition-colors">取消</button>
                                <button onClick={handleSaveNote} className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 flex items-center gap-1 font-bold shadow-sm transition-colors">
                                    <Save size={16}/> 保存笔记
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-800 text-[15px] whitespace-pre-wrap leading-relaxed">
                            {currentNote.user_note ? (
                              currentNote.user_note 
                            ) : (
                              <span className="text-yellow-600/50 italic text-sm">暂无笔记，好记性不如烂笔头，随时记录你的灵光一闪吧~</span>
                            )}
                        </div>
                    )}
                 </div>
                 {/* ✨✨✨ 笔记模块结束 ✨✨✨ */}

                 {/* --- 举一反三模块 --- */}
                 <div className="mt-8 pt-6 border-t border-blue-100">
                    {!generatedQA && !isGenerating && (
                      <button onClick={handleGenerateSimilar} className="w-full py-3 flex items-center justify-center gap-2 text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl font-bold transition-colors">
                        <Sparkles size={18} /> 没完全懂？让 AI 举一反三出一道变式题
                      </button>
                    )}

                    {isGenerating && (
                      <div className="flex flex-col items-center justify-center py-6 text-purple-500 gap-3">
                        <Loader2 className="animate-spin" size={28} />
                        <span className="text-sm font-medium">AI 正在深度分析考点并生成新题...</span>
                      </div>
                    )}

                    {generatedQA && (
                      <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-5 animate-in fade-in zoom-in">
                        <div className="flex items-center gap-2 text-purple-700 font-bold mb-3">
                          <Sparkles size={18} /> AI 变式训练
                          <button onClick={handleGenerateSimilar} className="ml-auto text-purple-400 hover:text-purple-600" title="换一题"><RefreshCw size={14} /></button>
                        </div>
                        <div className="text-gray-800 font-medium mb-4 markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{generatedQA.question}</ReactMarkdown>
                        </div>
                        {!showGeneratedAnswer ? (
                          <button onClick={() => setShowGeneratedAnswer(true)} className="w-full py-2.5 bg-white border border-purple-200 text-purple-600 hover:bg-purple-100 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 shadow-sm">
                            <Eye size={16} /> 查看变式题解析
                          </button>
                        ) : (
                          <div className="bg-white p-4 rounded-lg border border-purple-100 text-sm text-gray-600 markdown-body animate-in slide-in-from-top-2 fade-in">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{generatedQA.answer}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                 </div>
             </div>
         ) : (
             <div className="h-1/3 flex items-center justify-center bg-gray-50 border-t border-dashed border-gray-200">
                 <button onClick={() => setIsFlipped(true)} className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 shadow-sm rounded-full text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all group">
                    <Eye size={20} className="group-hover:text-blue-500" /> 显示解析 & 验证
                 </button>
             </div>
         )}
      </div>

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