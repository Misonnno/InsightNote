"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import ReactMarkdown from "react-markdown";
import { Trash2, X, Calendar, Search, Image as ImageIcon, Tag, Star, Eye, EyeOff, Lightbulb, CheckCircle2, CircleDashed } from "lucide-react";

// ... (Type Note 保持不变，可以加上 is_mastered 可选)
type Note = {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  user_id: string;
  image_url?: string;
  tags: string[] | null;
  is_mastered?: boolean; // 新增字段
};

export default function LibraryPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 收藏夹相关
  const [collections, setCollections] = useState<any[]>([]);
  const [showAddToCollectionModal, setShowAddToCollectionModal] = useState<number | null>(null);
  const [collectedIds, setCollectedIds] = useState<Set<number>>(new Set());
  const [showAnalysis, setShowAnalysis] = useState(false);

  // ✨ 新增：Tab 状态 (active | mastered)
  const [activeTab, setActiveTab] = useState<"reviewing" | "mastered">("reviewing");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: notesData } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
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
    } else if (error.code === '23505') {
        alert("已在收藏夹中");
    }
  };

  const openNoteDetail = (note: Note) => {
    setSelectedNote(note);
    setShowAnalysis(false); 
  };

  // ✨✨✨ 核心过滤逻辑 ✨✨✨
  const filteredNotes = notes.filter(note => {
    // 1. 先按搜索词过滤
    const lowerTerm = searchTerm.toLowerCase();
    const matchSearch = note.question?.toLowerCase().includes(lowerTerm) || note.tags?.some(tag => tag.toLowerCase().includes(lowerTerm));
    
    // 2. 再按 Tab 过滤 (复习中 vs 已掌握)
    const matchTab = activeTab === "mastered" ? note.is_mastered === true : note.is_mastered !== true;

    return matchSearch && matchTab;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen">
      
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">📚 错题宝库</h1>
        </div>
        <div className="relative w-full md:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input type="text" placeholder="搜题目 / 搜知识点..." className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* ✨✨✨ Tab 切换按钮 ✨✨✨ */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button 
            onClick={() => setActiveTab("reviewing")}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "reviewing" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
            <CircleDashed size={16} /> 复习中
            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">
                {notes.filter(n => !n.is_mastered).length}
            </span>
        </button>
        <button 
            onClick={() => setActiveTab("mastered")}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "mastered" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
            <CheckCircle2 size={16} /> 已掌握
            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">
                {notes.filter(n => n.is_mastered).length}
            </span>
        </button>
      </div>
      
      {/* 错题列表 (内容不变，但数据源是 filteredNotes) */}
      <div className="grid gap-4">
        {filteredNotes.map((note) => {
          const isCollected = collectedIds.has(note.id);
          return (
            <div key={note.id} onClick={() => openNoteDetail(note)} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 cursor-pointer flex justify-between items-start group transition-all">
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-gray-800 text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">{note.question}</p>
                        {note.image_url && <ImageIcon size={16} className="text-blue-400 flex-shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        {note.tags?.map(t => <span key={t} className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded font-medium border border-blue-100"><Tag size={10} /> {t}</span>)}
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={12}/> {new Date(note.created_at).toLocaleDateString()}</span>
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
            {activeTab === "mastered" ? <p className="text-sm text-gray-400">去复习页把题目标记为“已掌握”吧！</p> : null}
          </div>
        )}
      </div>

      {/* 详情弹窗 (保持不变，省略部分重复代码以节省空间，直接用之前最新的即可) */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedNote(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">📖 错题详情</h3>
                <button onClick={() => setSelectedNote(null)} className="text-gray-400 hover:text-gray-800"><X /></button>
             </div>
             <div className="p-6 overflow-y-auto">
                {selectedNote.image_url && <div className="mb-6 bg-gray-50 p-3 rounded-xl border border-gray-200"><img src={selectedNote.image_url} alt="错题原图" className="w-full max-h-[400px] object-contain rounded-lg shadow-sm bg-white" /></div>}
                <div className="mb-6"><h4 className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">题目 / Question</h4><p className="text-gray-900 font-medium text-lg leading-relaxed bg-blue-50/50 p-4 rounded-xl border border-blue-100 whitespace-pre-wrap">{selectedNote.question}</p></div>
                <div>
                    <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-bold text-green-600 uppercase tracking-wide">AI 深度解析 / Analysis</h4><button onClick={() => setShowAnalysis(!showAnalysis)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">{showAnalysis ? <EyeOff size={14}/> : <Eye size={14}/>}{showAnalysis ? "隐藏解析" : "查看解析"}</button></div>
                    {showAnalysis ? <div className="markdown-body bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 animate-in fade-in slide-in-from-top-2"><ReactMarkdown>{selectedNote.answer}</ReactMarkdown></div> : <div onClick={() => setShowAnalysis(true)} className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all group"><Lightbulb className="mx-auto text-gray-300 mb-2 group-hover:text-yellow-500 transition-colors" size={32} /><p className="text-gray-500 font-medium group-hover:text-blue-600">💡 解析已隐藏，点击查看</p></div>}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* 收藏弹窗 (保持不变，省略) */}
      {showAddToCollectionModal && (
         /* 请使用之前发给你的收藏夹弹窗代码 */
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