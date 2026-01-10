import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WordDistributionCardProps {
  data: { range: string; count: number }[];
  className?: string;
}

export function WordDistributionCard({ data, className = '' }: WordDistributionCardProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const mostCommonRange = data.reduce((max, curr) => (curr.count > max.count ? curr : max), data[0]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-6 border border-emerald-100 dark:border-emerald-800/30 ${className}`}
    >
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />

      {/* 标题区 */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">字数分布</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">笔记长度分析</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{mostCommonRange.range}</div>
          <div className="text-xs text-slate-600 dark:text-gray-400">最常见区间</div>
        </div>
      </div>

      {/* 图表区 */}
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#1e293b', fontWeight: 600 }}
              itemStyle={{ color: '#10b981' }}
              formatter={(value: number | undefined) => {
                if (value === undefined) return ['', ''];
                const percentage = ((value / total) * 100).toFixed(1);
                return [`${value} 篇 (${percentage}%)`, '笔记数'];
              }}
            />
            <Bar
              dataKey="count"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              name="笔记数"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 提示信息 */}
      <div className="mt-3 text-xs text-slate-500 dark:text-gray-400 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>共 {total} 篇笔记</span>
      </div>
    </motion.div>
  );
}
