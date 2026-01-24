"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../supabase";
import { Loader2, Image as ImageIcon, Send, X, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  // 输入状态
  const [question, setQuestion] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 输出状态
  const [loading, setLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(""); // 只存当前这道题的解析
  const [saveStatus, setSaveStatus] = useState(""); // 保存成功提示

  // 1. 检查登录
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/login");
      else setUser(session.user);
    };
    checkUser();
  }, [router]);

  // 2. 图片处理
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setSaveStatus(""); // 重置状态
      setCurrentAnswer(""); // 重置答案
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 3. 核心逻辑：AI 分析 + 自动保存
  const askAI = async () => {
    if (!question && !selectedImage) return;
    setLoading(true);
    setCurrentAnswer("");
    setSaveStatus("");

    try {
      let aiAnswer = "";
      let aiTitle = "";
      let aiTags: string[] = [];
      let uploadedImageUrl = "";

      // A. 上传图片到 Supabase Storage
      if (selectedImage && user) {
        const fileName = `${user.id}/${Date.now()}_${selectedImage.name}`;
        const { error: uploadError } = await supabase.storage.from('mistakes').upload(fileName, selectedImage);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('mistakes').getPublicUrl(fileName);
          uploadedImageUrl = publicUrl;
        }
      }

      // B. 调用后端 AI
      if (selectedImage) {
        const formData = new FormData();
        const systemPrompt = `
你是一个智能助教。请分析图片并输出纯净的 JSON 字符串。
格式要求：
{
  "title": "简短的语义标题，如'【数学】导数单调性'",
  "analysis": "详细解析，支持 Markdown",
  "tags": ["知识点1", "知识点2"]
}
`;
        formData.append("text", `${systemPrompt}\n\n用户的补充问题：${question || ""}`);
        formData.append("image", selectedImage);

        const res = await fetch("http://127.0.0.1:8000/analyze_image", { method: "POST", body: formData });
        const data = await res.json();
        
        if (data.analysis) {
            aiAnswer = data.analysis;
            aiTitle = data.title;
            aiTags = data.tags || [];
        } else {
            aiAnswer = data.error || "AI 解析格式异常";
            aiTitle = "解析失败";
        }
      } else {
        // 纯文字模式
        const res = await fetch("http://127.0.0.1:8000/ask_ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }),
        });
        const data = await res.json();
        aiAnswer = data.answer || data.error;
        aiTitle = question;
      }

      setCurrentAnswer(aiAnswer);

      // C. 自动保存到数据库
      if (aiAnswer && user) {
        const finalTitle = aiTitle || question || "无标题错题";

        const { error } = await supabase.from("notes").insert([{ 
          question: finalTitle,
          answer: aiAnswer, 
          user_id: user.id,
          image_url: uploadedImageUrl,
          tags: aiTags
        }]);

        if (!error) {
            setSaveStatus("✅ 已自动存入错题库！");
            // 可以在这里选择清空输入，或者保留给用户看
            // clearImage(); 
            // setQuestion("");
        }
      }

    } catch (err) {
      console.error(err);
      setCurrentAnswer("❌ 发生网络错误，请检查后端服务。");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      
      {/* 标题区 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">上传新错题 📝</h1>
        <p className="text-gray-500">拍照上传，AI 自动分析并归档到你的知识库</p>
      </div>

      {/* 输入卡片 */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 transition-all">
        
        {/* 图片预览区 */}
        {imagePreview && (
          <div className="mb-4 relative inline-block group">
            <img src={imagePreview} alt="Preview" className="h-48 rounded-lg border border-gray-200 object-cover shadow-sm" />
            <button 
                onClick={clearImage} 
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-transform hover:scale-110"
            >
                <X size={14} />
            </button>
          </div>
        )}

        {/* 文本输入区 */}
        <textarea
          className="w-full p-4 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all resize-none text-gray-700 placeholder-gray-400 bg-gray-50/50"
          rows={4}
          placeholder="在此输入问题，或者直接上传图片..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        {/* 底部工具栏 */}
        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm"
            >
              <ImageIcon size={18} />
              {imagePreview ? "更换图片" : "上传图片"}
            </button>
            <span className="text-xs text-gray-400 hidden md:inline">支持 JPG, PNG</span>
          </div>

          <button
            onClick={askAI}
            disabled={loading || (!question && !selectedImage)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 ${
              loading || (!question && !selectedImage)
                ? "bg-gray-300 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:-translate-y-0.5"
            }`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            {loading ? "AI 思考中..." : "开始分析"}
          </button>
        </div>
      </div>

      {/* 结果反馈区 */}
      {(currentAnswer || saveStatus) && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           
           {/* 保存成功提示 */}
           {saveStatus && (
             <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-xl border border-green-100 font-medium">
                <CheckCircle2 size={20} />
                {saveStatus}
                <button 
                  onClick={() => router.push('/library')} 
                  className="ml-auto text-sm underline hover:text-green-800"
                >
                  去错题库查看 &rarr;
                </button>
             </div>
           )}

           {/* AI 解析展示 */}
           {currentAnswer && (
             <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
               <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                 🤖 AI 解析结果
               </h3>
               {/* 👇 修复了 className 报错：把样式放在外层 div */}
               <div className="markdown-body text-gray-700 leading-relaxed">
                  <ReactMarkdown>{currentAnswer}</ReactMarkdown>
               </div>
             </div>
           )}
        </div>
      )}

    </div>
  );
}