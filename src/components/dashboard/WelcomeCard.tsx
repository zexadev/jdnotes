import { motion } from 'framer-motion';
import { Sparkles, Plus, ArrowRight } from 'lucide-react';
import { BentoCard } from './BentoGrid';

interface WelcomeCardProps {
  className?: string;
  onCreateNote: () => void;
  onNavigate: (view: 'inbox' | 'favorites' | 'calendar') => void;
}

export function WelcomeCard({ className, onCreateNote, onNavigate }: WelcomeCardProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  return (
    <BentoCard className={className}>
      <div className="p-6 h-full flex flex-col justify-between">
        {/* 问候文字 */}
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 mb-2"
          >
            <Sparkles className="w-5 h-5 text-[#5E6AD2] transition-colors duration-300" />
            <span className="text-sm font-medium text-slate-500 dark:text-gray-400 transition-colors duration-300">
              {new Date().toLocaleDateString('zh-CN', {
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold text-slate-900 dark:text-white mb-1 transition-colors duration-300"
          >
            {greeting} 👋
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 dark:text-gray-400 text-sm transition-colors duration-300"
          >
            继续你的创作之旅
          </motion.p>
        </div>

        {/* 快速操作按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3"
        >
          <button
            onClick={onCreateNote}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                     bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 text-white rounded-xl
                     transition-all duration-300 hover:scale-105 active:scale-95
                     font-medium text-sm shadow-lg shadow-[#5E6AD2]/20"
          >
            <Plus className="w-4 h-4" />
            新建笔记
          </button>

          <button
            onClick={() => onNavigate('inbox')}
            className="flex items-center justify-center gap-2 px-4 py-3
                     bg-black/[0.03] dark:bg-white/5 hover:bg-black/[0.06] dark:hover:bg-white/10
                     text-slate-700 dark:text-white rounded-xl
                     transition-all duration-300 hover:scale-105 active:scale-95
                     font-medium text-sm border border-black/[0.06] dark:border-white/10"
          >
            查看全部
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </BentoCard>
  );
}
