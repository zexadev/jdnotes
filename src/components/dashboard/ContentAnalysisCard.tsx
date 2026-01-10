import { motion } from 'framer-motion';
import { useState } from 'react';
import { BarChart3, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ContentAnalysisCardProps {
  wordDistribution: { range: string; count: number }[];
  totalNotes: number;
  totalWords: number;
  avgWords: number;
  activeDays: number;
  streak: number;
  className?: string;
}

type ViewMode = 'words' | 'activity';

export function ContentAnalysisCard({
  wordDistribution,
  totalNotes,
  totalWords,
  avgWords,
  activeDays,
  streak,
  className = ''
}: ContentAnalysisCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('words');

  const total = wordDistribution.reduce((sum, item) => sum + item.count, 0);
  const mostCommonRange = wordDistribution.reduce((max, curr) =>
    curr.count > max.count ? curr : max, wordDistribution[0]
  );

  const tabs = [
    { id: 'words' as ViewMode, label: '字数分布', icon: BarChart3 },
    { id: 'activity' as ViewMode, label: '活跃统计', icon: Activity },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4 md:p-6 border border-emerald-100 dark:border-emerald-800/30 transition-all duration-300 ${className}`}
    >
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />

      {/* 标题和切换按钮 */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            {viewMode === 'words' && <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            {viewMode === 'activity' && <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white transition-colors duration-300">内容分析</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 transition-colors duration-300">
              {viewMode === 'words' ? '笔记长度分析' : '写作活跃度'}
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
                    ? 'bg-emerald-600 text-white shadow-sm'
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
        {/* 字数分布视图 */}
        {viewMode === 'words' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex items-end justify-between">
              <div className="text-right">
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 transition-colors duration-300">
                  {mostCommonRange.range}
                </div>
                <div className="text-xs text-slate-600 dark:text-gray-400 transition-colors duration-300">最常见区间</div>
              </div>
            </div>
            <div className="h-56 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wordDistribution} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
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
            <div className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-2 transition-colors duration-300">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>共 {total} 篇笔记</span>
            </div>
          </motion.div>
        )}

        {/* 活跃统计视图 */}
        {viewMode === 'activity' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 py-2 md:py-4"
          >
            {/* 统计卡片网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {/* 总字数 */}
              <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-700/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center transition-colors duration-300">
                    <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-colors duration-300" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-gray-400 transition-colors duration-300">总字数</div>
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 transition-colors duration-300">
                  {totalWords.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-500 mt-1 transition-colors duration-300">
                  平均 {avgWords} 字/篇
                </div>
              </div>

              {/* 总笔记数 */}
              <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-700/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center transition-colors duration-300">
                    <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400 transition-colors duration-300" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-gray-400 transition-colors duration-300">总笔记</div>
                </div>
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 transition-colors duration-300">
                  {totalNotes}
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-500 mt-1 transition-colors duration-300">
                  持续记录中
                </div>
              </div>

              {/* 活跃天数 */}
              <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-700/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center transition-colors duration-300">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-gray-400 transition-colors duration-300">活跃天数</div>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 transition-colors duration-300">
                  {activeDays}
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-500 mt-1 transition-colors duration-300">
                  累计活跃
                </div>
              </div>

              {/* 连续天数 */}
              <div className="bg-white/60 dark:bg-slate-800/60 rounded-xl p-4 border border-emerald-200/50 dark:border-emerald-700/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center transition-colors duration-300">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-gray-400 transition-colors duration-300">连续天数</div>
                </div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 transition-colors duration-300">
                  {streak}
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-500 mt-1 transition-colors duration-300">
                  {streak > 0 ? '保持记录' : '开始记录'}
                </div>
              </div>
            </div>

            {/* 底部提示 */}
            <div className="text-xs text-center text-slate-500 dark:text-gray-400 pt-2 transition-colors duration-300">
              💪 坚持写作,养成好习惯
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
