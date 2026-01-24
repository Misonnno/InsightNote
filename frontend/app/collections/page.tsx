"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { FolderPlus, Trash2, Folder, X, Eye, EyeOff, Lightbulb, Image as ImageIcon, Tag, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [activeCollection, setActiveCollection] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  // ✨ 1. 新增：详情弹窗所需的状态
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from("collections")
        .select("*, collection_items(id)") 
        .eq("user_id", session.user.id);

      if (data) setCollections(data);
    }
  };

  const createCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;

    if (collections.some(c => c.name === name)) {
        alert("这个收藏夹名字已经存在啦，换个名字吧！");
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase
        .from("collections")
        .insert([{ name: name, user_id: session.user.id }]);

      if (error) {
        if (error.code === '23505') alert("创建失败：文件夹名字不能重复");
      } else {
        setNewCollectionName("");
        fetchCollections();
      }
    }
  };

  const deleteCollection = async (id: number, e: any) => {
    e.stopPropagation();
    if (!confirm("确定删除这个收藏夹吗？里面的题目关联也会被移除（原题不会删）。")) return;
    await supabase.from("collections").delete().match({ id });
    fetchCollections();
    if (activeCollection?.id === id) setActiveCollection(null);
  };

  const openCollection = async (collection: any) => {
    setActiveCollection(collection);
    const { data } = await supabase
      .from("collection_items")
      .select("note_id, notes(*)")
      .eq("collection_id", collection.id);
    
    if (data) {
        // 过滤掉 notes 为 null 的情况 (防止脏数据)
        const validNotes = data.map((item: any) => item.notes).filter(n => n !== null);
        setItems(validNotes);
    }
  };

  const removeItem = async (noteId: number, e: any) => {
      e.stopPropagation(); // 防止触发弹窗
      if(!confirm("要把这道题移出收藏夹吗？")) return;

      await supabase.from("collection_items").delete().match({ 
          collection_id: activeCollection.id,
          note_id: noteId 
      });
      setItems(items.filter(i => i.id !== noteId));
  };

  // ✨ 2. 打开详情逻辑 (默认折叠解析)
  const openNoteDetail = (note: any) => {
    setSelectedNote(note);
    setShowAnalysis(false); 
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 h-[calc(100vh-80px)]">
      
      {/* 左侧：文件夹列表 */}
      <div className="w-full md:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col h-1/2 md:h-full">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">📂 我的收藏夹</h2>
        
        <div className="flex gap-2 mb-4">
          <input 
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition"
            placeholder="新建文件夹名..."
            value={newCollectionName}
            onChange={e => setNewCollectionName(e.target.value)}
          />
          <button onClick={createCollection} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition">
            <FolderPlus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {collections.map(c => (
            <div 
              key={c.id}
              onClick={() => openCollection(c)}
              className={`p-3 rounded-xl cursor-pointer flex justify-between items-center group transition-all ${
                activeCollection?.id === c.id ? "bg-blue-50 text-blue-700 border-blue-200 border shadow-sm" : "hover:bg-gray-50 text-gray-700 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <Folder size={18} className={activeCollection?.id === c.id ? "fill-blue-200" : ""} />
                <div className="flex items-center gap-2 truncate">
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        {/* 这里的 ?.length 就是数量 */}
                        {c.collection_items?.length || 0}
                    </span>
                </div>
              </div>
              <button onClick={(e) => deleteCollection(c.id, e)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {collections.length === 0 && <p className="text-center text-gray-400 text-sm py-4">暂无收藏夹</p>}
        </div>
      </div>

      {/* 右侧：题目列表 */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col h-full">
        {activeCollection ? (
          <>
            <div className="mb-6 border-b pb-4 flex justify-between items-center">
              <h3 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                 <Folder className="text-blue-500 fill-blue-100" /> 
                 {activeCollection.name}
                 <span className="text-sm bg-gray-100 text-gray-500 px-2 py-1 rounded-full ml-2 font-normal">{items.length} 题</span>
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
               {items.length === 0 && (
                 <div className="text-center py-20 flex flex-col items-center">
                    <p className="text-gray-400 mb-4">这里还是空的，去错题库添加题目吧！</p>
                    <a href="/library" className="text-blue-600 hover:underline">前往错题库 &rarr;</a>
                 </div>
               )}
               
               {items.map(note => (
                 <div 
                    key={note.id} 
                    // ✨ 3. 点击卡片 -> 打开详情
                    onClick={() => openNoteDetail(note)}
                    className="border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-blue-200 transition-all group relative cursor-pointer bg-white"
                 >
                    {/* 移除按钮 */}
                    <button 
                        onClick={(e) => removeItem(note.id, e)}
                        className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 z-10 transition-opacity"
                        title="移出此收藏夹"
                    >
                        <Trash2 size={18} />
                    </button>

                    <div className="pr-8">
                        {/* 题目 & 图片标 */}
                        <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{note.question}</h4>
                            {note.image_url && <ImageIcon size={16} className="text-blue-400 flex-shrink-0" />}
                        </div>
                        
                        {/* 标签 & 日期 */}
                        <div className="flex flex-wrap gap-2 items-center mt-2">
                            {note.tags && note.tags.length > 0 ? (
                                note.tags.map((t: string) => (
                                <span key={t} className="flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded font-medium border border-blue-100">
                                    <Tag size={10} /> {t}
                                </span>
                                ))
                            ) : (
                                <span className="text-xs text-gray-400 italic">无标签</span>
                            )}
                            <span className="text-gray-300 text-xs">|</span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar size={12}/> {new Date(note.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                 </div>
               ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Folder size={32} className="text-gray-300" />
             </div>
             <p>请选择左侧的一个收藏夹查看</p>
          </div>
        )}
      </div>

      {/* ✨ 4. 详情弹窗 (完全复用 Library 的逻辑) */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedNote(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
             
             {/* 弹窗顶部 */}
             <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">📖 错题详情</h3>
                <button onClick={() => setSelectedNote(null)} className="text-gray-400 hover:text-gray-800"><X /></button>
             </div>

             {/* 内容区域 */}
             <div className="p-6 overflow-y-auto">
                
                {selectedNote.image_url && (
                  <div className="mb-6 bg-gray-100 p-2 rounded-xl border border-gray-200 text-center">
                    <img src={selectedNote.image_url} alt="错题原图" className="max-h-64 mx-auto rounded-lg shadow-sm object-contain" />
                  </div>
                )}

                <div className="mb-6">
                    <h4 className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-wide">题目 / Question</h4>
                    <p className="text-gray-900 font-medium text-lg leading-relaxed bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        {selectedNote.question}
                    </p>
                </div>

                {/* AI 解析 (带折叠) */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-green-600 uppercase tracking-wide">AI 深度解析 / Analysis</h4>
                        <button 
                            onClick={() => setShowAnalysis(!showAnalysis)}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                        >
                            {showAnalysis ? <EyeOff size={14}/> : <Eye size={14}/>}
                            {showAnalysis ? "隐藏解析" : "查看解析"}
                        </button>
                    </div>

                    {showAnalysis ? (
                        <div className="markdown-body bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 animate-in fade-in slide-in-from-top-2">
                            <ReactMarkdown>{selectedNote.answer}</ReactMarkdown>
                        </div>
                    ) : (
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
    </div>
  );
}