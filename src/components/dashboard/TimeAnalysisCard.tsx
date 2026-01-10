import { motion } from 'framer-motion';
import { useState } from 'react';
import { TrendingUp, Clock, Calendar } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TimeAnalysisCardProps {
  trendData: { date: string; count: number }[];
  hourlyData: { hour: string; count: number }[];
  distribution: Map<string, number>;
  onNavigate: (view: 'calendar') => void;
  className?: string;
}

type ViewMode = 'trend' | 'hourly' | 'heatmap';

export function TimeAnalysisCard({
  trendData,
  hourlyData,
  distribution,
  onNavigate,
  className = ''
}: TimeAnalysisCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('trend');

  const maxTrendCount = Math.max(...trendData.map(d => d.count), 1);
  const totalTrendCount = trendData.reduce((sum, d) => sum + d.count, 0);

  const maxHourlyCount = Math.max(...hourlyData.map(d => d.count), 1);
  const mostActiveHour = hourlyData.reduce((max, curr) =>
    curr.count > max.count ? curr : max, hourlyData[0]
  );

  // 热力图数据处理
  const getHeatmapData = () => {
    const now = new Date();
    const heatmapData: { date: string; count: number; month: number; day: number }[] = [];

    for (let i = 89; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      heatmapData.push({
        date: dateKey,
        count: distribution.get(dateKey) || 0,
        month: date.getMonth(),
        day: date.getDate(),
      });
    }

    return heatmapData;
  };

  const heatmapData = getHeatmapData();
  const maxHeatmapCount = Math.max(...heatmapData.map(d => d.count), 1);

  const getHeatColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    const intensity = Math.min(count / maxHeatmapCount, 1);
    if (intensity < 0.25) return 'bg-blue-200 dark:bg-blue-900/40';
    if (intensity < 0.5) return 'bg-blue-400 dark:bg-blue-700/60';
    if (intensity < 0.75) return 'bg-blue-600 dark:bg-blue-600/80';
    return 'bg-blue-800 dark:bg-blue-500';
  };

  const tabs = [
    { id: 'trend' as ViewMode, label: '趋势', icon: TrendingUp },
    { id: 'hourly' as ViewMode, label: '时段', icon: Clock },
    { id: 'heatmap' as ViewMode, label: '热力图', icon: Calendar },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 md:p-6 border border-blue-100 dark:border-blue-800/30 transition-all duration-300 ${className}`}
    >
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl" />

      {/* 标题和切换按钮 */}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl">
            {viewMode === 'trend' && <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            {viewMode === 'hourly' && <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            {viewMode === 'heatmap' && <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white transition-colors duration-300">时间分析</h3>
            <p className="text-sm text-slate-600 dark:text-gray-400 transition-colors duration-300">
              {viewMode === 'trend' && '过去 30 天趋势'}
              {viewMode === 'hourly' && '24 小时活跃分布'}
              {viewMode === 'heatmap' && '过去 90 天热力图'}
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
                    ? 'bg-blue-600 text-white shadow-sm'
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

      {/* 图表区 */}
      <div className="relative">
        {/* 趋势折线图 */}
        {viewMode === 'trend' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex items-end justify-between">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 transition-colors duration-300">{totalTrendCount}</div>
                <div className="text-xs text-slate-600 dark:text-gray-400 transition-colors duration-300">30天总计</div>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, maxTrendCount + 1]}
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
                    itemStyle={{ color: '#3b82f6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    activeDot={{ r: 5, fill: '#2563eb' }}
                    name="笔记数"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* 写作时段柱状图 */}
        {viewMode === 'hourly' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex items-end justify-between">
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400 transition-colors duration-300">{mostActiveHour.hour}</div>
                <div className="text-xs text-slate-600 dark:text-gray-400 transition-colors duration-300">最活跃时段</div>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
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
                    domain={[0, maxHourlyCount + 1]}
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
                    itemStyle={{ color: '#3b82f6' }}
                    formatter={(value: number | undefined) => value !== undefined ? [`${value} 篇`, '笔记数'] : ['', '']}
                  />
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    name="笔记数"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* 热力图 */}
        {viewMode === 'heatmap' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-400">
                <span>少</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
                  <div className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-900/40" />
                  <div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-700/60" />
                  <div className="w-3 h-3 rounded-sm bg-blue-600 dark:bg-blue-600/80" />
                  <div className="w-3 h-3 rounded-sm bg-blue-800 dark:bg-blue-500" />
                </div>
                <span>多</span>
              </div>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                查看日历
              </button>
            </div>
            <div className="grid grid-cols-10 sm:grid-cols-13 md:grid-cols-15 gap-1 overflow-x-auto">
              {heatmapData.map((item, index) => (
                <div
                  key={index}
                  className={`w-full aspect-square rounded-sm ${getHeatColor(item.count)} transition-colors cursor-pointer hover:ring-2 hover:ring-blue-500`}
                  title={`${item.date}: ${item.count} 篇笔记`}
                />
              ))}
            </div>
            <div className="text-xs text-slate-500 dark:text-gray-400 text-center mt-2 transition-colors duration-300">
              过去 90 天的笔记活跃度
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
