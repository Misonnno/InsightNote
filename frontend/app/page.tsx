"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Send, Loader2, FileText, CheckCircle2, BrainCircuit, Database } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../supabase";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; 

interface AIResponse {
  title: string;
  conclusion: string;
  analysis: string;
  tags?: string[];
}

// 🛠️ 核心修改：超强兼容性解析器
const parseStreamToAIResponse = (text: string): AIResponse => {
  const result: AIResponse = {
    title: "题目识别中...",
    analysis: "", 
    conclusion: "AI 正在计算结论...",
    tags: []
  };

  // 1. 尝试寻找各个章节的起始位置
  // 匹配规则：不管是 # 还是 ## 还是加粗，只要包含关键字符就识别
  const findPos = (keywords: string[]) => {
    for (const kw of keywords) {
      const index = text.indexOf(kw);
      if (index !== -1) return { index, kw };
    }
    return null;
  };

  const titleMarker = findPos(["# 题目", "## 题目", "**题目**", "题目："]);
  const analysisMarker = findPos(["# 深度解析", "## 深度解析", "**深度解析**", "深度解析："]);
  const conclusionMarker = findPos(["# 最终答案", "## 最终答案", "**最终答案**", "最终答案："]);
  const tagsMarker = findPos(["# 标签", "## 标签", "**标签**", "标签："]);

  // 2. 切片逻辑：根据标记位置动态切开文本
  // 题目部分
  if (titleMarker) {
    const end = analysisMarker?.index || conclusionMarker?.index || tagsMarker?.index || text.length;
    result.title = text.substring(titleMarker.index + titleMarker.kw.length, end).trim();
  }

  // 解析部分 (最重要：如果没识别出结论，所有的字都先塞给解析过程)
  if (analysisMarker) {
    const end = conclusionMarker?.index || tagsMarker?.index || text.length;
    result.analysis = text.substring(analysisMarker.index + analysisMarker.kw.length, end).trim();
  } else if (titleMarker) {
    // 还没看到“深度解析”字样？先把题目之后的所有内容都放在解析框里，让用户看到实时输出
    result.analysis = text.substring(titleMarker.index + titleMarker.kw.length).trim();
  } else {
    // 啥标记都没看到？那就直接把全文给解析框
    result.analysis = text.trim();
  }

  // 结论部分
  if (conclusionMarker) {
    const end = tagsMarker?.index || text.length;
    result.conclusion = text.substring(conclusionMarker.index + conclusionMarker.kw.length, end).trim();
  }

  // 标签部分
  if (tagsMarker) {
    const rawTags = text.substring(tagsMarker.index + tagsMarker.kw.length).trim();
    result.tags = rawTags.replace(/[()（）*#]/g, "").split(/,|，|\s+/).filter(t => t);
  }

  return result;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const askAI = async () => {
    if (!question.trim() && !selectedImage) {
      alert("请输入问题或上传图片");
      return;
    }

    setLoading(true);
    // 初始化状态
    setAiResult({
      title: "准备中...",
      analysis: "正在建立连接...", // 给用户即时反馈
      conclusion: "",
      tags: []
    });

    try {
      const endpoint = selectedImage 
        ? "http://127.0.0.1:8000/analyze_image" 
        : "http://127.0.0.1:8000/ask_ai";

      let response;

      if (selectedImage) {
        const formData = new FormData();
        formData.append("text", question || "请详细解析这道题");
        formData.append("image", selectedImage);
        response = await fetch(endpoint, { method: "POST", body: formData });
      } else {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }),
        });
      }

      if (!response.ok || !response.body) throw new Error(`Status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          // 每次收到数据，都强制更新 UI
          setAiResult(parseStreamToAIResponse(fullText));
        }
      }

    } catch (error) {
      console.error("请求失败:", error);
      setAiResult({
          title: "连接失败",
          analysis: `**无法连接到后端服务**\n\n请检查：\n1. 后端终端是否有报错？\n2. 是否运行了 python main.py？\n3. 报错详情: ${String(error)}`,
          conclusion: "请检查后台",
          tags: []
      });
    } finally {
      setLoading(false);
    }
  };

  const addToLibrary = async () => {
    if (!aiResult) return;
    setSaveLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert("请先登录后再保存错题！");
        setSaveLoading(false);
        return;
      }

      let uploadedImageUrl = null;
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`; 

        const { error: uploadError } = await supabase.storage
          .from('mistakes') 
          .upload(filePath, selectedImage);

        if (uploadError) {
          alert(`图片上传失败: ${uploadError.message}`);
          setSaveLoading(false);
          return;
        }

        const { data } = supabase.storage.from('mistakes').getPublicUrl(filePath);
        uploadedImageUrl = data.publicUrl;
      }

      const fullAnswer = `**最终结论：**\n${aiResult.conclusion}\n\n---\n\n**深度解析：**\n${aiResult.analysis}`;

      const { error } = await supabase.from('notes').insert({
        user_id: session.user.id,
        question: aiResult.title || "未命名题目",
        answer: fullAnswer,
        tags: aiResult.tags || [],
        image_url: uploadedImageUrl,
      });

      if (error) {
        alert(`保存失败: ${error.message}`);
      } else {
        alert("✅ 已成功保存到云端错题库！");
      }

    } catch (e) {
      console.error(e);
      alert("保存过程出错");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 flex items-center justify-center gap-3">
          <BrainCircuit className="text-blue-600 w-10 h-10" />
          InsightNote AI 助手
        </h1>
        <p className="text-gray-500">Gemini 1.5 Flash 强力驱动</p>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="space-y-4">
            <textarea
              className="w-full p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 resize-none text-gray-700 placeholder-gray-400 outline-none transition-all"
              placeholder="在这里输入你的问题，或者对图片的补充说明..."
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            {preview && (
              <div className="relative inline-block group">
                <Image src={preview} alt="Preview" width={200} height={200} className="rounded-lg border border-gray-200 object-cover h-32 w-auto" />
                <button onClick={clearImage} className="absolute -top-2 -right-2 bg-white shadow-md rounded-full p-1 text-gray-500 hover:text-red-500 transition-colors"><X size={16} /></button>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"><Upload size={18} /> 上传图片</button>
              </div>

              <button
                onClick={askAI}
                disabled={loading || (!question && !selectedImage)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-all ${loading || (!question && !selectedImage) ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"}`}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                {loading ? "思考中..." : "开始解析"}
              </button>
            </div>
          </div>
        </div>

        {aiResult && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-50 text-blue-600 p-2 rounded-lg"><FileText size={20} /></span>
                <h3 className="font-bold text-gray-800">识别信息</h3>
              </div>
              <div className="prose prose-blue max-w-none text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">
                 {/* 如果还没有解析出题目，显示占位符或 loading 状态 */}
                 {aiResult.title === "题目识别中..." ? <span className="text-gray-400 italic">正在从内容中提取题目...</span> : <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{aiResult.title}</ReactMarkdown>}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-green-100 text-green-700 p-2 rounded-lg"><CheckCircle2 size={20} /></span>
                <h3 className="font-bold text-green-900">最终答案</h3>
              </div>
              <div className="text-xl font-bold text-green-800 leading-relaxed">
                 {aiResult.conclusion === "计算中..." ? <span className="text-gray-400 text-base font-normal italic">AI 正在计算结论...</span> : <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{aiResult.conclusion}</ReactMarkdown>}
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="bg-purple-50 text-purple-600 p-2 rounded-lg"><BrainCircuit size={20} /></span>
                  <h3 className="font-bold text-lg text-gray-800">AI 解析过程</h3>
                </div>
                <button onClick={addToLibrary} disabled={loading || saveLoading} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${loading || saveLoading ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "text-purple-600 bg-purple-50 hover:bg-purple-100"}`}>
                  {saveLoading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  {saveLoading ? "保存中..." : (loading ? "生成完毕可保存" : "存入错题库")}
                </button>
              </div>
              
              <div className="markdown-body text-gray-700 leading-relaxed space-y-4">
                {/* 这里会实时显示所有内容，不管 AI 格式对不对 */}
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {aiResult.analysis}
                </ReactMarkdown>
              </div>

              {aiResult.tags && aiResult.tags.length > 0 && (
                <div className="mt-8 pt-4 border-t border-gray-100 flex gap-2 flex-wrap">
                  {aiResult.tags.map((tag, index) => (
                    <span key={index} className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}