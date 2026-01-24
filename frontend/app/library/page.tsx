"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import ReactMarkdown from "react-markdown";
import { Trash2, X, Calendar, Search, Image as ImageIcon, Tag, Star, Folder, Eye, EyeOff, Lightbulb } from "lucide-react";

type Note = {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  user_id: string;
  image_url?: string;
  tags: string[] | null;
};

export default function LibraryPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 收藏夹相关状态
  const [collections, setCollections] = useState<any[]>([]);
  const [showAddToCollectionModal, setShowAddToCollectionModal] = useState<number | null>(null);
  const [collectedIds, setCollectedIds] = useState<Set<number>>(new Set());

  // ✨ 1. 新增：控制解析显示的开关 (默认 false)
  const [showAnalysis, setShowAnalysis] = useState(false);

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

      const { data: collectionData } = await supabase
        .from("collections")
        .select("*")
        .eq("user_id", session.user.id);
      if (collectionData) setCollections(collectionData);

      const { data: itemsData } = await supabase
        .from("collection_items")
        .select("note_id")
        .in('collection_id', collectionData?.map(c => c.id) || []);
      
      if (itemsData) {
        const ids = new Set(itemsData.map(item => item.note_id));
        setCollectedIds(ids);
      }
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
    
    const { error } = await supabase.from("collection_items").insert({
        collection_id: collectionId,
        note_id: showAddToCollectionModal
    });

    if (error && error.code === '23505') {
        alert("这道题已经在这个收藏夹里啦！");
    } else if (!error) {
        alert("收藏成功！");
        setCollectedIds(prev => {
            const newSet = new Set(prev);
            newSet.add(showAddToCollectionModal);
            return newSet;
        });
        setShowAddToCollectionModal(null);
    }
  };

  // ✨ 2. 打开详情时，重置状态为“隐藏”
  const openNoteDetail = (note: Note) => {
    setSelectedNote(note);
    setShowAnalysis(false); // 每次打开新题，都先折叠解析
  };

  const filteredNotes = notes.filter(note => {
    const lowerTerm = searchTerm.toLowerCase();
    const matchQuestion = note.question?.toLowerCase().includes(lowerTerm);
    const matchTags = note.tags?.some(tag => tag.toLowerCase().includes(lowerTerm));
    return matchQuestion || matchTags;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen">
      
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📚 错题宝库
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            共收录 {notes.length} 道错题
          </p>
        </div>

        <div className="relative w-full md:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="搜题目 / 搜知识点..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* 错题列表 */}
      <div className="grid gap-4">
        {filteredNotes.map((note) => {
          const isCollected = collectedIds.has(note.id);
          return (
            <div
                key={note.id}
                // ✨ 3. 点击列表时调用 openNoteDetail
                onClick={() => openNoteDetail(note)}
                className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 cursor-pointer flex justify-between items-start group transition-all"
            >
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-gray-800 text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">
                            {note.question}
                        </p>
                        {note.image_url && <ImageIcon size={16} className="text-blue-400 flex-shrink-0" />}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {note.tags && note.tags.length > 0 ? (
                            note.tags.map(t => (
                            <span key={t} className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded font-medium border border-blue-100">
                                <Tag size={10} /> {t}
                            </span>
                            ))
                        ) : (
                            <span className="text-xs text-gray-400 italic">无标签</span>
                        )}
                        <span className="text-gray-300">|</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar size={12}/> {new Date(note.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowAddToCollectionModal(note.id); }}
                        className={`p-2 rounded-full transition-colors ${
                            isCollected 
                                ? "text-yellow-400 bg-yellow-50 hover:bg-yellow-100"
                                : "text-gray-300 hover:text-yellow-500 hover:bg-yellow-50"
                        }`}
                        title={isCollected ? "已收藏" : "加入收藏夹"}
                    >
                        <Star size={18} className={isCollected ? "fill-current" : ""} />
                    </button>

                    <button 
                        onClick={(e) => deleteNote(note.id, e)} 
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="删除错题"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
          );
        })}
        
        {filteredNotes.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400 mb-2">🔍 找不到相关错题</p>
            <button onClick={() => setSearchTerm("")} className="text-blue-500 text-sm hover:underline">清除搜索</button>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedNote(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
             
             {/* 顶部 */}
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">📖 错题详情</h3>
                <button onClick={() => setSelectedNote(null)} className="text-gray-400 hover:text-gray-800"><X /></button>
             </div>

             {/* 内容区域 */}
             <div className="p-6 overflow-y-auto">
                
                {/* 图片 */}
                {selectedNote.image_url && (
                  <div className="mb-6 bg-gray-100 p-2 rounded-xl border border-gray-200 text-center">
                    <img src={selectedNote.image_url} alt="错题原图" className="max-h-64 mx-auto rounded-lg shadow-sm object-contain" />
                  </div>
                )}

                {/* 题目 (始终显示) */}
                <div className="mb-6">
                    <h4 className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">题目 / Question</h4>
                    <p className="text-gray-900 font-medium text-lg leading-relaxed bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        {selectedNote.question}
                    </p>
                </div>

                {/* ✨ 4. AI 解析 (带折叠功能) */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-green-600 uppercase tracking-wide">AI 深度解析 / Analysis</h4>
                        {/* 切换按钮 */}
                        <button 
                            onClick={() => setShowAnalysis(!showAnalysis)}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                        >
                            {showAnalysis ? <EyeOff size={14}/> : <Eye size={14}/>}
                            {showAnalysis ? "隐藏解析" : "查看解析"}
                        </button>
                    </div>

                    {showAnalysis ? (
                        // 显示状态：展示 Markdown 内容
                        <div className="markdown-body bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 animate-in fade-in slide-in-from-top-2">
                            <ReactMarkdown>{selectedNote.answer}</ReactMarkdown>
                        </div>
                    ) : (
                        // 隐藏状态：展示占位卡片
                        <div 
                            onClick={() => setShowAnalysis(true)}
                            className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
                        >
                            <Lightbulb className="mx-auto text-gray-300 mb-2 group-hover:text-yellow-500 transition-colors" size={32} />
                            <p className="text-gray-500 font-medium group-hover:text-blue-600">
                                💡 解析已隐藏，先自己思考一下吧！
                            </p>
                            <p className="text-xs text-gray-400 mt-1">点击此处展开</p>
                        </div>
                    )}
                </div>

             </div>
          </div>
        </div>
      )}

      {/* 收藏夹弹窗 */}
      {showAddToCollectionModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowAddToCollectionModal(null)}>
           <div className="bg-white rounded-xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4 text-center">选择收藏夹</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                  {collections.map(c => (
                      <button 
                          key={c.id} 
                          onClick={() => addToCollection(c.id)}
                          className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 flex items-center gap-2 transition-colors border border-transparent hover:border-blue-100"
                      >
                          <Folder size={16} className="text-yellow-500 fill-yellow-500" /> 
                          {c.name}
                      </button>
                  ))}
                  {collections.length === 0 && (
                    <div className="text-center py-4">
                        <p className="text-gray-400 text-sm mb-2">还没有收藏夹</p>
                        <a href="/collections" className="text-blue-600 text-sm font-bold underline">去新建一个 &rarr;</a>
                    </div>
                  )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}