"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../supabase";
import { Trash2, X, MessageSquare, Calendar, LogOut, User, Image as ImageIcon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

// 定义错题的数据结构
type Note = {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  user_id: string;
  image_url?: string;
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. 检查登录
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/login");
      else {
        setUser(session.user);
        fetchNotes();
      }
    };
    checkUser();
  }, [router]);

  // 2. 退出
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 3. 拉取列表
  const fetchNotes = async () => {
    const { data, error } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
    if (!error) setNotes(data || []);
  };

  // 4. 删除
  const deleteNote = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除吗？")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (!error) { fetchNotes(); if (selectedNote?.id === id) setSelectedNote(null); }
  };

  // 5. 图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 🧠 核心：解析 + 智能提取标题 + 保存
  const askAI = async () => {
    if (!question && !selectedImage) return;
    setLoading(true);
    setAnswer("");

    try {
      let aiAnswer = "";
      let uploadedImageUrl = "";

      // 👉 A. 上传图片
      if (selectedImage && user) {
        const fileName = `${user.id}/${Date.now()}_${selectedImage.name}`;
        const { error: uploadError } = await supabase.storage.from('mistakes').upload(fileName, selectedImage);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('mistakes').getPublicUrl(fileName);
          uploadedImageUrl = publicUrl;
        }
      }

      // 👉 B. AI 分析
      if (selectedImage) {
        const formData = new FormData();
        // 提示词保持不变，让 AI 输出【题目】和【解析】
        const prompt = question || "请做两件事：1. 把图片里的题目文字提取出来（标为【题目】）。2. 给出详细的解析和答案（标为【解析】）。";
        formData.append("text", prompt);
        formData.append("image", selectedImage);

        const res = await fetch("http://127.0.0.1:8000/analyze_image", { method: "POST", body: formData });
        const data = await res.json();
        aiAnswer = data.answer || data.error;

      } else {
        const res = await fetch("http://127.0.0.1:8000/ask_ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }),
        });
        const data = await res.json();
        aiAnswer = data.answer || data.error;
      }

      setAnswer(aiAnswer);

      // 👉 C. 🌟 智能提取标题逻辑 (这里是新加的！)
      if (aiAnswer && user) {
        let finalQuestion = question; // 默认使用用户手写的

        // 如果用户没手写问题，而且是图片模式，我们尝试从 AI 回答里抠出题目
        if (!finalQuestion && selectedImage) {
          // 正则表达式：寻找 "【题目】" 后面的文字，直到换行符
          const match = aiAnswer.match(/【题目】\s*(.+)/);
          if (match && match[1]) {
            finalQuestion = match[1].trim(); // 成功提取！
          } else {
            finalQuestion = "📸 [图片错题] (自动提取失败)"; // 兜底
          }
        }
        
        // 最后兜底
        if (!finalQuestion) finalQuestion = "无标题问题";

        // 存入数据库
        await supabase.from("notes").insert([{ 
          question: finalQuestion, // 👈 这里现在是 AI 提取出来的真题目了！
          answer: aiAnswer, 
          user_id: user.id,
          image_url: uploadedImageUrl 
        }]);
        
        fetchNotes();
        clearImage();
        setQuestion("");
      }

    } catch (err) {
      console.error(err);
      setAnswer("发生错误，请检查网络或后端。");
    }
    setLoading(false);
  };

  if (!user) return <div className="flex h-screen items-center justify-center text-blue-600"><Loader2 className="animate-spin mr-2"/> 加载中...</div>;

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 bg-gray-50 text-gray-800 font-sans">
      <div className="z-10 max-w-5xl w-full flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-blue-600 flex items-center gap-2">InsightNote 🧠</h1>
        <div className="flex items-center gap-4">
           <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full shadow-sm">
            <User size={14} /> {user.email}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><LogOut size={16} /> 退出</button>
        </div>
      </div>

      <div className="w-full max-w-3xl bg-white p-6 rounded-2xl shadow-xl mb-8 border border-gray-100 transition-all">
        {imagePreview && (
          <div className="mb-4 relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-32 rounded-lg border border-gray-200 object-cover" />
            <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"><X size={12} /></button>
          </div>
        )}

        <textarea
          className="w-full p-4 border-2 border-gray-100 rounded-xl focus:outline-none focus:border-blue-500 text-black placeholder-gray-400 bg-gray-50 transition-all resize-none"
          rows={3}
          placeholder={selectedImage ? "AI 将自动提取题目并解析..." : "输入错题、代码或概念..."}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        
        <div className="mt-4 flex justify-between items-center">
          <div className="relative">
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" id="img-upload"/>
            <label htmlFor="img-upload" className="cursor-pointer flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50">
              <ImageIcon size={20} /> <span className="text-sm font-medium">上传错题</span>
            </label>
          </div>
          <button onClick={askAI} disabled={loading || (!question && !selectedImage)} className={`px-6 py-2.5 rounded-xl text-white font-bold transition-all flex items-center gap-2 shadow-md ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5"}`}>
            {loading ? <><Loader2 size={18} className="animate-spin"/> 处理中...</> : <>✨ 解析并保存</>}
          </button>
        </div>

        {answer && (
          <div className="mt-6 p-6 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-bottom-2">
             <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2 text-lg"><MessageSquare size={20}/> 解析结果：</h3>
             <div className="markdown-body text-gray-800 leading-relaxed">
                <ReactMarkdown>{answer}</ReactMarkdown>
             </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-3xl">
        <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">📚 我的错题库</h2>
        <div className="grid gap-3">
          {notes.map((note) => (
            <div key={note.id} onClick={() => setSelectedNote(note)} className="bg-white p-4 rounded-xl border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer flex gap-4 group">
              {note.image_url && (
                <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <img src={note.image_url} alt="缩略图" className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                   {/* 列表这里也会显示提取出来的真题目 */}
                   <h3 className="font-bold text-gray-800 line-clamp-1">{note.question}</h3>
                   <button onClick={(e) => deleteNote(note.id, e)} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                </div>
                <p className="text-gray-500 text-xs mt-1 flex items-center gap-1"><Calendar size={10} /> {new Date(note.created_at).toLocaleString()}</p>
                <div className="text-gray-400 text-sm mt-1 line-clamp-1">{note.answer.slice(0, 50).replace(/[#*`]/g, '')}...</div>
              </div>
            </div>
          ))}
          {notes.length === 0 && <p className="text-center text-gray-400 py-8">暂无记录</p>}
        </div>
      </div>

      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedNote(null)}>
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between bg-gray-50">
              <h2 className="font-bold text-lg">📝 错题详情</h2>
              <button onClick={() => setSelectedNote(null)}><X className="text-gray-500 hover:text-black"/></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {selectedNote.image_url && (
                <div className="mb-6 bg-gray-50 p-2 rounded-xl border border-gray-200 text-center">
                  <img src={selectedNote.image_url} alt="错题原图" className="max-h-64 mx-auto rounded-lg shadow-sm" />
                  <p className="text-xs text-gray-400 mt-2">原题快照</p>
                </div>
              )}

              <h3 className="font-bold text-lg mb-3 text-blue-700">问题/题目：</h3>
              {/* 这里就是你想要的！显示提取出来的题目 */}
              <p className="text-gray-800 mb-6 bg-blue-50 p-3 rounded-lg font-medium">{selectedNote.question}</p>

              <h3 className="font-bold text-lg mb-3 text-green-700">AI 解析：</h3>
              <div className="markdown-body text-gray-700 leading-relaxed">
                <ReactMarkdown components={{
                    strong: ({node, ...props}) => <span className="font-bold text-blue-900" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-2" {...props} />,
                    code: ({node, ...props}) => (<code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm font-mono" {...props} />),
                }}>{selectedNote.answer}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}