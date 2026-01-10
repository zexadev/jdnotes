import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HourlyActivityCardProps {
  data: { hour: string; count: number }[];
  className?: string;
}

export function HourlyActivityCard({ data, className = '' }: HourlyActivityCardProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const mostActiveHour = data.reduce((max, curr) => (curr.count > max.count ? curr : max), data[0]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-6 border border-amber-100 dark:border-amber-800/30 ${className}`}
    >
      {/* 背景装饰 */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl" />

      {/* 标题区 */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">写作时段</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">24 小时活跃分布</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{mostActiveHour.hour}</div>
          <div className="text-xs text-slate-600 dark:text-gray-400">最活跃时段</div>
        </div>
      </div>

      {/* 图表区 */}
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              domain={[0, maxCount + 1]}
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
              itemStyle={{ color: '#f59e0b' }}
              formatter={(value: number | undefined) => value !== undefined ? [`${value} 篇`, '笔记数'] : ['', '']}
            />
            <Bar
              dataKey="count"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              name="笔记数"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
