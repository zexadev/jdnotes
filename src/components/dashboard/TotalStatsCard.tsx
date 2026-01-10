import { motion } from 'framer-motion';
import { BookOpen, TrendingUp } from 'lucide-react';

interface TotalStatsCardProps {
  totalNotes: number;
  weeklyGrowth: number;
  totalWords: number;
  onCreateNote: () => void;
  onNavigate: (view: 'inbox' | 'favorites' | 'calendar') => void;
}

export function TotalStatsCard({
  totalNotes,
  weeklyGrowth,
  totalWords,
  onCreateNote,
  onNavigate,
}: TotalStatsCardProps) {
  // 格式化字数显示
  const formatWordCount = (count: number): string => {
    if (count < 1000) {
      return `${count} 字`;
    }
    return `${Math.round(count / 1000)}K 字`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[2rem] p-8 text-black shadow-lg flex-1"
      style={{
        background: 'linear-gradient(135deg, #4ade80 0%, #a3e635 100%)',
      }}
    >
      {/* 装饰性背景光晕 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-300 opacity-20 rounded-full translate-y-1/3 -translate-x-1/4 blur-xl pointer-events-none" />

      {/* 内容区域 */}
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-6 h-6" strokeWidth={2.5} />
            <p className="text-lg font-medium opacity-80">总笔记数</p>
          </div>
          <h2 className="text-5xl font-bold mb-2">
            {totalNotes.toLocaleString()}
            <span className="text-2xl align-top ml-1">篇</span>
          </h2>
          <p className="text-sm font-medium opacity-70 flex items-center gap-1">
            {weeklyGrowth > 0 && <TrendingUp className="w-4 h-4" />}
            本周新增 {weeklyGrowth} 篇
            {totalWords > 0 && ` · 共计 ${formatWordCount(totalWords)}`}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 mt-10">
          <button
            onClick={onCreateNote}
            className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-900 transition-all hover:shadow-lg active:scale-95"
          >
            新建笔记
          </button>
          <div className="bg-white/40 backdrop-blur-sm rounded-full p-1 pr-2 flex items-center gap-2">
            <button
              onClick={() => onNavigate('inbox')}
              className="px-6 py-2 bg-transparent text-black font-medium text-sm hover:bg-white/30 rounded-full transition-colors"
            >
              查看全部
            </button>
            <button
              onClick={() => onNavigate('favorites')}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <TrendingUp className="w-4 h-4 transform -rotate-45" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
