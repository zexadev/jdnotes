import { motion } from 'framer-motion';
import { useState } from 'react';
import { Tag, PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface TagAnalysisCardProps {
  tags: { name: string; count: number }[];
  categoryData: { name: string; value: number; color: string }[];
  className?: string;
}

type ViewMode = 'cloud' | 'pie';

export function TagAnalysisCard({ tags, categoryData, className = '' }: TagAnalysisCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('cloud');

  // 标签云相关
  const maxCount = Math.max(...tags.map(t => t.count), 1);
  const minSize = 0.75;
  const maxSize = 1.5;

  const getTagSize = (count: number): number => {
    const ratio = count / maxCount;
    return minSize + ratio * (maxSize - minSize);
  };

  const colors = [
    'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
    'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
    'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20',
    'text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    'text-pink-600 dark:text-pink-400 bg-pink-500/10 border-pink-500/20',
  ];

  // 饼图相关
  const total = categoryData.reduce((sum, item) => sum + item.value, 0);

  const tabs = [
    { id: 'cloud' as ViewMode, label: '标签云', icon: Tag },
    { id: 'pie' as ViewMode, label: '分布图', icon: PieIcon },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-4 md:p-6 border border-purple-100 dark:border-purple-800/30 transition-all duration-300 ${className}`}
    >
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-purple-400/10 rounded-full blur-3xl" />

      {/* 标题和切换按钮 */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl">
            {viewMode === 'cloud' && <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            {viewMode === 'pie' && <PieIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white transition-colors duration-300">标签分析</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 transition-colors duration-300">
              {viewMode === 'cloud' ? '热门标签展示' : 'Top 6 标签占比'}
            </p>
          </div>
        </div>

        {/* 视图切换按钮 */}
        <div className="flex gap-1 bg-white/50 dark:bg-slate-800/50 rounded-lg p-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === tab.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-white/80 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 内容区 */}
      <div className="relative">
        {/* 标签云视图 */}
        {viewMode === 'cloud' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            exit={{ opacity: 0, y: -10 }}
            className="h-64 flex flex-wrap items-center justify-center gap-2 content-center"
          >
            {tags.length === 0 ? (
              <div className="text-center text-slate-500 dark:text-gray-500 text-sm transition-colors duration-300">
                暂无标签
              </div>
            ) : (
              tags.map((tag, idx) => (
                <motion.div
                  key={tag.name}
                  whileHover={{ scale: 1.1, y: -2 }}
                  className={`
                    px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border cursor-pointer
                    transition-all duration-200
                    ${colors[idx % colors.length]}
                  `}
                  style={{
                    fontSize: `${getTagSize(tag.count) * 0.9}rem`,
                  }}
                >
                  <span className="font-medium">#{tag.name}</span>
                  <span className="ml-1 text-[0.7rem] md:text-xs opacity-60">{tag.count}</span>
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* 饼图视图 */}
        {viewMode === 'pie' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="h-64"
          >
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '8px 12px',
                    }}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return ['', ''];
                      const percentage = ((value / total) * 100).toFixed(1);
                      return [`${value} 篇 (${percentage}%)`, '笔记数'];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value, entry: any) => {
                      const percentage = ((entry.payload.value / total) * 100).toFixed(0);
                      return `${value} (${percentage}%)`;
                    }}
                    wrapperStyle={{
                      fontSize: '11px',
                      paddingTop: '10px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 dark:text-gray-500 transition-colors duration-300">
                暂无标签数据
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
