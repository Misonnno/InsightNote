"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import dynamic from 'next/dynamic';

// 动态引入组件
const KnowledgeGraph = dynamic(() => import('../components/KnowledgeGraph'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center animate-pulse">
       <span className="text-gray-400">🌌 星云图正在生成...</span>
    </div>
  )
});

export default function GraphPage() {
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    const fetchNotes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from("notes").select("*").eq("user_id", session.user.id);
        if (data) setNotes(data);
      }
    };
    fetchNotes();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 h-[calc(100vh-100px)]">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">🌌 知识星云</h1>
      <div className="w-full h-full">
         <KnowledgeGraph notes={notes} onTagClick={(tag) => alert(`点击了标签：${tag}，后续可以在这里跳转到筛选页`)} />
      </div>
    </div>
  );
}