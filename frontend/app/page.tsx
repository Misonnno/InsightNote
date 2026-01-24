"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../supabase";
import { Loader2, Image as ImageIcon, Send, X, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

// ✨ 强力清洗函数：不管 AI 返回什么乱七八糟的格式，都试着提取出 JSON
const tryParseJSON = (input: any): any => {
  // 如果已经是对象，直接用
  if (typeof input === 'object' && input !== null) {
      return input;
  }
  
  if (typeof input !== 'string') return null;

  try {
    // 1. 最完美的情况：直接是 JSON 字符串
    return JSON.parse(input);
  } catch (e) {
    // 2. AI 经常喜欢加 Markdown 代码块，比如 ```json ... ```，我们要把它剥掉
    const jsonMatch = input.match(/```json([\s\S]*?)```/) || input.match(/```([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        // 继续尝试
      }
    }

    // 3. 暴力提取：找到第一个 { 和最后一个 }，截取中间的部分
    const start = input.indexOf('{');
    const end = input.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        const cleanStr = input.substring(start, end + 1);
        // 处理可能存在的转义字符问题
        return JSON.parse(cleanStr);
      } catch (e3) {
        return null;
      }
    }
    return null;
  }
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  const [question, setQuestion] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/login");
      else setUser(session.user);
    };
    checkUser();
  }, [router]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setSaveStatus("");
      setCurrentAnswer("");
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 3. 核心逻辑：AI 分析 + 自动保存
  const askAI = async () => {
    if (!question && !selectedImage) {
        alert("请先输入问题或上传图片！");
        return;
    }

    setLoading(true);
    setCurrentAnswer("");
    setSaveStatus("");

    try {
      let aiAnswer = "";
      let aiTitle = "";
      let aiTags: string[] = [];
      let uploadedImageUrl = "";

      // A. 上传图片逻辑 (保持不变)
      if (selectedImage && user) {
        try {
            const fileExt = selectedImage.name.split('.').pop();
            const sanitizedFileName = `${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${sanitizedFileName}`;

            const { error: uploadError } = await supabase.storage
                .from('mistakes')
                .upload(filePath, selectedImage);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('mistakes')
                .getPublicUrl(filePath);
            
            uploadedImageUrl = publicUrl;
        } catch (uploadErr) {
            console.error("图片上传失败:", uploadErr);
            alert("图片上传失败，请检查网络设置。");
            setLoading(false);
            return;
        }
      }

      // B. 调用 AI (👇👇👇 这里是修改的核心 👇👇👇)
      if (selectedImage) {
        const formData = new FormData();
        const systemPrompt = `
你是一个智能助教。请分析图片并输出纯净的 JSON 字符串（不要使用 Markdown 代码块）。
格式要求：
{
  "title": "请OCR识别图片中的【完整题目文字】，不要摘要。",
  "analysis": "请直接输出详细的解题步骤和思考过程。不要重复这句话，直接开始写解析。",
  "tags": ["知识点1", "知识点2"]
}
`;
        formData.append("text", `${systemPrompt}\n\n用户的补充问题：${question || ""}`);
        formData.append("image", selectedImage);

        const res = await fetch("http://127.0.0.1:8000/analyze_image", { method: "POST", body: formData });
        
        // 🛡️ 防崩卫士：先按纯文本读取，不要直接 .json()
        const resText = await res.text();
        console.log("后端返回原始数据:", resText); // 👈 看控制台这里打印了什么！

        let data;
        try {
            data = JSON.parse(resText);
        } catch (e) {
            // 如果解析失败，说明后端挂了，返回了报错信息
            throw new Error(`后端服务报错: ${resText.slice(0, 50)}... (请查看控制台)`);
        }
        
        // 剩下的逻辑和之前一样，使用清洗函数
        const parsed = tryParseJSON(data.analysis) || tryParseJSON(data);

        if (parsed && parsed.analysis) {
            aiAnswer = parsed.analysis;
            aiTitle = parsed.title;
            aiTags = parsed.tags || [];
        } else if (data.analysis && typeof data.analysis === 'string') {
             aiAnswer = data.analysis;
             aiTitle = "解析格式异常";
        } else {
             aiAnswer = data.error || "AI 返回格式无法识别";
             aiTitle = "解析失败";
        }

      } else {
        // 纯文字模式
        const res = await fetch("http://127.0.0.1:8000/ask_ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }),
        });
        const resText = await res.text();
        let data;
        try {
            data = JSON.parse(resText);
        } catch (e) {
             throw new Error(`后端服务报错: ${resText}`);
        }
        aiAnswer = data.answer || data.error;
        aiTitle = question;
      }

      setCurrentAnswer(aiAnswer);

      // C. 存入数据库 (保持不变)
      if (aiAnswer && user) {
        const finalTitle = aiTitle || question || "未命名错题";
        
        const { error } = await supabase.from("notes").insert([{ 
          question: finalTitle,
          answer: aiAnswer, 
          user_id: user.id,
          image_url: uploadedImageUrl,
          tags: aiTags
        }]);

        if (!error) {
            setSaveStatus("✅ 已自动存入错题库！");
        }
      }

    } catch (err: any) {
      console.error(err);
      // 把真正的错误信息显示在界面上
      setCurrentAnswer(`❌ 发生错误: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">上传新错题 📝</h1>
        <p className="text-gray-500">拍照上传，AI 自动分析并归档</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 transition-all">
        {imagePreview && (
          <div className="mb-4 relative inline-block group">
            <img src={imagePreview} alt="Preview" className="h-48 rounded-lg border border-gray-200 object-cover shadow-sm" />
            <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-transform hover:scale-110"><X size={14} /></button>
          </div>
        )}

        <textarea
          className="w-full p-4 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all resize-none text-gray-700 placeholder-gray-400 bg-gray-50/50"
          rows={4}
          placeholder="在此输入问题，或者直接上传图片..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm">
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
            {loading ? "AI 分析中..." : "开始分析"}
          </button>
        </div>
      </div>

      {(currentAnswer || saveStatus) && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {saveStatus && (
             <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-xl border border-green-100 font-medium">
                <CheckCircle2 size={20} />
                {saveStatus}
                <button onClick={() => router.push('/library')} className="ml-auto text-sm underline hover:text-green-800">去错题库查看 &rarr;</button>
             </div>
           )}
           {currentAnswer && (
             <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
               <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">🤖 AI 解析结果</h3>
               <div className="markdown-body text-gray-700 leading-relaxed">
                  {/* 这里只渲染 pure markdown，确保不再出现 JSON 字符串 */}
                  <ReactMarkdown>{currentAnswer}</ReactMarkdown>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}