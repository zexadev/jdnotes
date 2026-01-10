import { motion } from 'framer-motion';
import { PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CategoryPieCardProps {
  data: { name: string; value: number; color: string }[];
  className?: string;
}

export function CategoryPieCard({ data, className = '' }: CategoryPieCardProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-6 border border-purple-100 dark:border-purple-800/30 ${className}`}
    >
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-purple-400/10 rounded-full blur-3xl" />

      {/* 标题区 */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-xl">
            <PieIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">标签分布</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">Top 6 标签占比</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{data.length}</div>
          <div className="text-xs text-slate-600 dark:text-gray-400">分类</div>
        </div>
      </div>

      {/* 图表区 */}
      <div className="relative h-64">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
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
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-gray-500">
            暂无标签数据
          </div>
        )}
      </div>
    </motion.div>
  );
}
