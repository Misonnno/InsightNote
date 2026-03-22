// frontend/app/library/page.tsx
"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../supabase"; 
import ReactMarkdown from "react-markdown";
import { Trash2, X, Calendar, Search, Image as ImageIcon, Tag, Star, Eye, EyeOff, Lightbulb, CheckCircle2, CircleDashed, Edit3, Save } from "lucide-react";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Note = {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  user_id: string;
  image_url?: string;
  tags: string[] | null;
  is_mastered?: boolean;
  user_note?: string; // ✨ 新增字段
};

function LibraryContent() {
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag") || "";

  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialTag);
  
  const [collections, setCollections] = useState<any[]>([]);
  const [showAddToCollectionModal, setShowAddToCollectionModal] = useState<number | null>(null);
  const [collectedIds, setCollectedIds] = useState<Set<number>>(new Set());
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState<"reviewing" | "mastered">("reviewing");

  // ✨ 笔记相关状态
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempNoteText, setTempNoteText] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: notesData } = await supabase.from("notes").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      if (notesData) setNotes(notesData);

      const { data: collectionData } = await supabase.from("collections").select("*").eq("user_id", session.user.id);
      if (collectionData) setCollections(collectionData);

      const { data: itemsData } = await supabase.from("collection_items").select("note_id").in('collection_id', collectionData?.map(c => c.id) || []);
      if (itemsData) setCollectedIds(new Set(itemsData.map(item => item.note_id)));
    }
  };

  const deleteNote = async (id: number, e: any) => {
    e.stopPropagation();
    if (!confirm("确定删除吗？")) return;
    await supabase.from("notes").delete().match({ id });
    setNotes(notes.filter((n) => n.id !== id));
  };

  const addToCollection = async (collectionId: number) => {
    if (!showAddToCollectionModal) return;
    const { error } = await supabase.from("collection_items").insert({ collection_id: collectionId, note_id: showAddToCollectionModal });
    if (!error) {
        alert("收藏成功！");
        setCollectedIds(prev => new Set(prev).add(showAddToCollectionModal));
        setShowAddToCollectionModal(null);
    } else if (error && error.code === '23505') {
        alert("已在收藏夹中");
    }
  };

  const openNoteDetail = (note: Note) => {
    setSelectedNote(note);
    setShowAnalysis(false); 
    setIsEditingNote(false); // 打开新详情时，重置笔记编辑状态
  };

  // ✨ 保存笔记
  const handleSaveNote = async () => {
    if (!selectedNote) return;

    const { error } = await supabase
      .from("notes")
      .update({ user_note: tempNoteText })
      .eq("id", selectedNote.id);

    if (error) {
      alert("保存笔记失败：" + error.message);
    } else {
      // 更新状态，保持弹窗依然打开且展示新数据
      const updatedNote = { ...selectedNote, user_note: tempNoteText };
      setSelectedNote(updatedNote);
      setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
      setIsEditingNote(false);
    }
  };

  const filteredNotes = notes.filter(note => {
    const lowerTerm = searchTerm.toLowerCase();
    const matchSearch = note.question?.toLowerCase().includes(lowerTerm) || note.tags?.some(tag => tag.toLowerCase().includes(lowerTerm));
    const matchTab = activeTab === "mastered" ? note.is_mastered === true : note.is_mastered !== true;
    return matchSearch && matchTab;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">📚 错题宝库</h1>
        </div>
        <div className="relative w-full md:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input type="text" placeholder="搜题目 / 搜知识点..." className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button onClick={() => setActiveTab("reviewing")} className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "reviewing" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <CircleDashed size={16} /> 复习中 <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">{notes.filter(n => !n.is_mastered).length}</span>
        </button>
        <button onClick={() => setActiveTab("mastered")} className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "mastered" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <CheckCircle2 size={16} /> 已掌握 <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">{notes.filter(n => n.is_mastered).length}</span>
        </button>
      </div>
      
      <div className="grid gap-4">
        {filteredNotes.map((note) => {
          const isCollected = collectedIds.has(note.id);
          return (
            <div key={note.id} onClick={() => openNoteDetail(note)} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 cursor-pointer flex justify-between items-start group transition-all">
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="font-bold text-gray-800 text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: "span" }}>{note.question}</ReactMarkdown>
                        </div>
                        {note.image_url && <ImageIcon size={16} className="text-blue-400 flex-shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        {note.tags?.map(t => <span key={t} className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded font-medium border border-blue-100"><Tag size={10} /> {t}</span>)}
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={12}/> {new Date(note.created_at).toLocaleDateString()}</span>
                        {/* 列表外层展示笔记小标签 */}
                        {note.user_note && <span className="text-xs text-yellow-600 flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100"><Edit3 size={10}/> 有笔记</span>}
                    </div>
                </div>
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setShowAddToCollectionModal(note.id); }} className={`p-2 rounded-full transition-colors ${isCollected ? "text-yellow-400 bg-yellow-50" : "text-gray-300 hover:text-yellow-500 hover:bg-yellow-50"}`}><Star size={18} className={isCollected ? "fill-current" : ""} /></button>
                    <button onClick={(e) => deleteNote(note.id, e)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18} /></button>
                </div>
            </div>
          );
        })}

        {filteredNotes.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400 mb-2">🔍 这里空空如也</p>
          </div>
        )}
      </div>

      {selectedNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedNote(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">📖 错题详情</h3>
                <button onClick={() => setSelectedNote(null)} className="text-gray-400 hover:text-gray-800"><X /></button>
             </div>
             <div className="p-6 overflow-y-auto">
                {selectedNote.image_url && <div className="mb-6 bg-gray-50 p-3 rounded-xl border border-gray-200"><img src={selectedNote.image_url} alt="错题原图" className="w-full max-h-[400px] object-contain rounded-lg shadow-sm bg-white" /></div>}
                
                <div className="mb-6">
                    <h4 className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">题目 / Question</h4>
                    <div className="text-gray-900 font-medium text-lg leading-relaxed bg-blue-50/50 p-4 rounded-xl border border-blue-100 whitespace-pre-wrap markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{selectedNote.question}</ReactMarkdown>
                    </div>
                </div>

                {/* ✨✨✨ 新增：我的笔记模块 ✨✨✨ */}
                <div className="mb-6 bg-yellow-50/50 border border-yellow-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-yellow-700 font-bold">
                            <Edit3 size={18} /> 我的笔记 / 批注
                        </div>
                        {!isEditingNote && (
                            <button 
                              onClick={() => {
                                setTempNoteText(selectedNote.user_note || "");
                                setIsEditingNote(true);
                              }} 
                              className="text-yellow-600 hover:text-yellow-800 text-sm font-medium flex items-center gap-1 bg-yellow-100/50 px-3 py-1 rounded-full transition-colors"
                            >
                                <Edit3 size={14}/> {selectedNote.user_note ? "编辑笔记" : "添加笔记"}
                            </button>
                        )}
                    </div>
                    
                    {isEditingNote ? (
                        <div className="flex flex-col gap-3 animate-in fade-in">
                            <textarea
                                value={tempNoteText}
                                onChange={(e) => setTempNoteText(e.target.value)}
                                className="w-full p-4 border border-yellow-300 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-[100px] resize-y shadow-inner"
                                placeholder="随时记录你的灵光一闪..."
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsEditingNote(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl font-medium transition-colors">取消</button>
                                <button onClick={handleSaveNote} className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 flex items-center gap-1 font-bold shadow-sm transition-colors">
                                    <Save size={16}/> 保存
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-800 text-[15px] whitespace-pre-wrap leading-relaxed">
                            {selectedNote.user_note ? (
                              selectedNote.user_note 
                            ) : (
                              <span className="text-yellow-600/50 italic text-sm">暂无笔记，好记性不如烂笔头~</span>
                            )}
                        </div>
                    )}
                </div>

                {/* 隐藏解析模块 */}
                <div>
                    <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-bold text-green-600 uppercase tracking-wide">AI 深度解析 / Analysis</h4><button onClick={() => setShowAnalysis(!showAnalysis)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">{showAnalysis ? <EyeOff size={14}/> : <Eye size={14}/>}{showAnalysis ? "隐藏解析" : "查看解析"}</button></div>
                    {showAnalysis ? <div className="markdown-body bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 animate-in fade-in slide-in-from-top-2">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{selectedNote.answer}</ReactMarkdown>
                    </div> : <div onClick={() => setShowAnalysis(true)} className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all group"><Lightbulb className="mx-auto text-gray-300 mb-2 group-hover:text-yellow-500 transition-colors" size={32} /><p className="text-gray-500 font-medium group-hover:text-blue-600">💡 解析已隐藏，点击查看</p></div>}
                </div>
             </div>
          </div>
        </div>
      )}

      {showAddToCollectionModal && (
         <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowAddToCollectionModal(null)}>
            <div className="bg-white rounded-xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
               <h3 className="font-bold text-lg mb-4 text-center">选择收藏夹</h3>
               <div className="space-y-2 max-h-60 overflow-y-auto">
                   {collections.map(c => <button key={c.id} onClick={() => addToCollection(c.id)} className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 flex items-center gap-2 transition-colors border border-transparent hover:border-blue-100">{c.name}</button>)}
                   {collections.length === 0 && <div className="text-center py-4"><p className="text-gray-400 text-sm mb-2">无收藏夹</p></div>}
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">📚 正在加载错题库...</div>}>
      <LibraryContent />
    </Suspense>
  );
}