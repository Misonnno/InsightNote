"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Send, Loader2, FileText, CheckCircle2, BrainCircuit, Database } from "lucide-react";
import ReactMarkdown from "react-markdown";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css"; 

interface AIResponse {
  title: string;
  conclusion: string;
  analysis: string;
  tags?: string[];
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const askAI = async () => {
    if (!question.trim() && !selectedImage) {
      alert("请输入问题或上传图片");
      return;
    }

    setLoading(true);
    setAiResult(null);

    try {
      const endpoint = selectedImage 
        ? "http://127.0.0.1:8000/analyze_image" 
        : "http://127.0.0.1:8000/ask_ai";

      let response;

      if (selectedImage) {
        const formData = new FormData();
        formData.append("text", question || "请详细解析这道题");
        formData.append("image", selectedImage);

        response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AIResponse = await response.json();
      setAiResult(data);

    } catch (error) {
      console.error("请求失败:", error);
      alert("无法连接到后端服务，请检查 uvicorn 是否已启动。\n错误信息: " + error);
    } finally {
      setLoading(false);
    }
  };

  // 👇 新增：添加到错题本功能
  const addToLibrary = async () => {
    if (!aiResult) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/review/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: aiResult.title,
          answer: aiResult.conclusion,
          analysis: aiResult.analysis,
          tags: aiResult.tags || [],
        }),
      });
      if (res.ok) {
        alert("✅ 已成功加入错题本！");
      } else {
        alert("❌ 添加失败，请检查后端 /review/add 接口");
      }
    } catch (e) {
      console.error(e);
      alert("无法连接到后端");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 flex items-center justify-center gap-3">
          <BrainCircuit className="text-blue-600 w-10 h-10" />
          InsightNote AI 助手
        </h1>
        <p className="text-gray-500">上传题目图片，DeepSeek + Qwen 为你深度解析</p>
      </div>

      <div className="w-full max-w-3xl space-y-6">
        {/* 输入区 */}
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
                <Image
                  src={preview}
                  alt="Preview"
                  width={200}
                  height={200}
                  className="rounded-lg border border-gray-200 object-cover h-32 w-auto"
                />
                <button
                  onClick={clearImage}
                  className="absolute -top-2 -right-2 bg-white shadow-md rounded-full p-1 text-gray-500 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                  accept="image/*"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                >
                  <Upload size={18} />
                  上传图片
                </button>
              </div>

              <button
                onClick={askAI}
                disabled={loading || (!question && !selectedImage)}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-all ${
                  loading || (!question && !selectedImage)
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                }`}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                {loading ? "深度思考中..." : "开始解析"}
              </button>
            </div>
          </div>
        </div>

        {/* 结果展示区 */}
        {aiResult && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 1. 题目 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                  <FileText size={20} />
                </span>
                <h3 className="font-bold text-gray-800">识别到的题目</h3>
              </div>
              <div className="prose prose-blue max-w-none text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {aiResult.title}
                </ReactMarkdown>
              </div>
            </div>

            {/* 2. 结论 */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-green-100 text-green-700 p-2 rounded-lg">
                  <CheckCircle2 size={20} />
                </span>
                <h3 className="font-bold text-green-900">最终答案</h3>
              </div>
              <div className="text-xl font-bold text-green-800 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {aiResult.conclusion}
                </ReactMarkdown>
              </div>
            </div>

            {/* 3. 深度解析 (含错题本按钮) */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="bg-purple-50 text-purple-600 p-2 rounded-lg">
                    <BrainCircuit size={20} />
                  </span>
                  <h3 className="font-bold text-lg text-gray-800">AI 深度解析</h3>
                </div>
                
                {/* 👇 按钮在这里 👇 */}
                <button
                  onClick={addToLibrary}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <Database size={16} />
                  存入错题库
                </button>
              </div>
              
              <div className="markdown-body text-gray-700 leading-relaxed space-y-4">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-6 mb-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-5 mb-3" {...props} />,
                    p: ({node, ...props}) => <p className="mb-4" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                  }}
                >
                  {aiResult.analysis}
                </ReactMarkdown>
              </div>

              {aiResult.tags && aiResult.tags.length > 0 && (
                <div className="mt-8 pt-4 border-t border-gray-100 flex gap-2 flex-wrap">
                  {aiResult.tags.map((tag, index) => (
                    <span key={index} className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      #{tag}
                    </span>
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