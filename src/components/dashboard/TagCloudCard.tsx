import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';
import { BentoCard } from './BentoGrid';

interface TagCloudCardProps {
  tags: { name: string; count: number }[];
  className?: string;
}

export function TagCloudCard({ tags, className }: TagCloudCardProps) {
  // 计算标签大小（基于使用频率）
  const maxCount = Math.max(...tags.map(t => t.count), 1);
  const minSize = 0.75;
  const maxSize = 1.5;

  const getTagSize = (count: number): number => {
    const ratio = count / maxCount;
    return minSize + ratio * (maxSize - minSize);
  };

  // 颜色变化
  const colors = [
    'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
    'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
    'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20',
    'text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    'text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/20',
  ];

  return (
    <BentoCard className={className}>
      <div className="p-6 h-full flex flex-col">
        {/* 标题 */}
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 text-slate-400 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">热门标签</h3>
        </div>

        {/* 标签云 */}
        <div className="flex-1 flex flex-wrap items-center justify-center gap-2 content-center">
          {tags.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-gray-500 text-sm">
              暂无标签
            </div>
          ) : (
            tags.map((tag, idx) => (
              <motion.div
                key={tag.name}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: idx * 0.02,
                  type: 'spring',
                  stiffness: 400,
                  damping: 20,
                }}
                whileHover={{ scale: 1.1, y: -2 }}
                className={`
                  px-3 py-1.5 rounded-lg border cursor-pointer
                  transition-all duration-200
                  ${colors[idx % colors.length]}
                `}
                style={{
                  fontSize: `${getTagSize(tag.count)}rem`,
                }}
              >
                <span className="font-medium">#{tag.name}</span>
                <span className="ml-1 text-xs opacity-60">{tag.count}</span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </BentoCard>
  );
}
