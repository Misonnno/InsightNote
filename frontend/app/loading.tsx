import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 text-blue-600">
        <Loader2 size={40} className="animate-spin" />
        <p className="text-gray-500 font-medium">数据加载中...</p>
      </div>
    </div>
  );
}