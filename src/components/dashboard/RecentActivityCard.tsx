import { motion } from 'framer-motion';
import { Clock, FileText } from 'lucide-react';
import { BentoCard } from './BentoGrid';

interface RecentNote {
  id: number;
  title: string;
  updatedAt: Date;
  preview: string;
}

interface RecentActivityCardProps {
  recentNotes: RecentNote[];
  className?: string;
}

export function RecentActivityCard({ recentNotes, className }: RecentActivityCardProps) {
  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <BentoCard className={className}>
      <div className="p-6 h-full flex flex-col">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-slate-400 dark:text-gray-400 transition-colors duration-300" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white transition-colors duration-300">最近活跃</h3>
        </div>

        {/* 笔记列表 */}
        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
          {recentNotes.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 dark:text-gray-500 text-sm transition-colors duration-300">
              暂无活跃笔记
            </div>
          ) : (
            recentNotes.map((note, idx) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ x: 4 }}
                className="flex items-start gap-3 p-3 rounded-lg
                         bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10
                         border border-transparent hover:border-slate-200 dark:hover:border-white/10
                         transition-all duration-300 cursor-pointer group"
              >
                <div className="flex-shrink-0 mt-1">
                  <FileText className="w-4 h-4 text-slate-400 dark:text-gray-400 group-hover:text-[#5E6AD2]
                                      transition-colors duration-300" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate mb-1
                               group-hover:text-[#5E6AD2] transition-colors duration-300">
                    {note.title || '无标题'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-gray-500 line-clamp-1 mb-1 transition-colors duration-300">
                    {note.preview}
                  </p>
                  <span className="text-xs text-slate-400 dark:text-gray-600 transition-colors duration-300">
                    {formatTime(note.updatedAt)}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </BentoCard>
  );
}
