"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import dynamic from 'next/dynamic';
import { useRouter } from "next/navigation";

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
  const router = useRouter();

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
      {/* 🚨 优化标题区域：增加副标题作为操作引导，替代内部图表的重复标题 */}
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-gray-800">🌌 知识星云</h1>
        <span className="text-sm text-gray-500 font-medium">点击节点可直接筛选并查看相关错题</span>
      </div>
      
      <div className="w-full h-full">
         <KnowledgeGraph 
            notes={notes} 
            onTagClick={(tag) => router.push(`/library?tag=${encodeURIComponent(tag)}`)} 
         />
      </div>
    </div>
  );
}