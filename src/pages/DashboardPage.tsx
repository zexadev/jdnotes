import {
  BookOpen,
  Star,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { TotalStatsCard } from '../components/dashboard/TotalStatsCard';
import { MetricCard } from '../components/dashboard/MetricCard';
import { WelcomeInfoCard } from '../components/dashboard/WelcomeInfoCard';
import { RecentActivityCard } from '../components/dashboard/RecentActivityCard';
import { TimeAnalysisCard } from '../components/dashboard/TimeAnalysisCard';
import { TagAnalysisCard } from '../components/dashboard/TagAnalysisCard';
import { ContentAnalysisCard } from '../components/dashboard/ContentAnalysisCard';

interface DashboardPageProps {
  onNavigate: (view: 'inbox' | 'favorites' | 'calendar') => void;
  onCreateNote: () => void;
}

export function DashboardPage({ onNavigate, onCreateNote }: DashboardPageProps) {
  const stats = useDashboardStats();

  return (
    <div className="h-full overflow-y-auto bg-transparent">
      <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-4 md:py-6">
        {/* 主网格布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧主要内容区 */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* 欢迎卡片 */}
            <WelcomeInfoCard />

            {/* 第一行: 主卡片 + 两个小卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* 主统计卡片 */}
              <div className="md:col-span-7 flex">
                <TotalStatsCard
                  totalNotes={stats.totalNotes}
                  weeklyGrowth={stats.weeklyGrowth}
                  totalWords={stats.totalWords}
                  onCreateNote={onCreateNote}
                  onNavigate={onNavigate}
                />
              </div>

              {/* 右侧两个小卡片 */}
              <div className="md:col-span-5 flex flex-col gap-6">
                <MetricCard
                  icon={Star}
                  title="收藏笔记"
                  value={stats.favoriteNotes}
                  unit="篇"
                  subtitle={`${stats.favoriteRatio}% 收藏率`}
                  onClick={() => onNavigate('favorites')}
                />
                <MetricCard
                  icon={Clock}
                  title="待办提醒"
                  value={stats.upcomingReminders}
                  unit="个"
                  subtitle={stats.upcomingReminders > 0 ? '需要关注' : '暂无待办'}
                  onClick={() => onNavigate('calendar')}
                />
              </div>
            </div>

            {/* 第二行: 时间分析和其他图表 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* 时间分析卡片 */}
              <div className="md:col-span-7">
                <TimeAnalysisCard
                  trendData={stats.trendData}
                  hourlyData={stats.hourlyActivity}
                  distribution={stats.distribution}
                  onNavigate={onNavigate}
                  className="h-[360px]"
                />
              </div>

              {/* 标签分析卡片 */}
              <div className="md:col-span-5">
                <TagAnalysisCard
                  tags={stats.topTags}
                  categoryData={stats.categoryData}
                  className="h-[360px]"
                />
              </div>
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className="lg:col-span-4 bg-gray-100 dark:bg-[#161722] rounded-[2.5rem] p-6 flex flex-col relative overflow-hidden" style={{ height: 'calc(100vh - 6rem)' }}>
            {/* 装饰性背景光晕 */}
            <div className="absolute top-20 right-0 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl pointer-events-none" />

            {/* 内容分析卡片 */}
            <div className="relative z-10">
              <ContentAnalysisCard
                wordDistribution={stats.wordDistribution}
                totalNotes={stats.totalNotes}
                totalWords={stats.totalWords}
                avgWords={stats.avgWords}
                activeDays={stats.activeDays}
                streak={stats.streak}
                className="bg-transparent border-0 shadow-none p-0"
              />
            </div>

            {/* 快捷操作区域 */}
            <div className="relative z-10 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-baseline gap-2 mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">快捷操作</h3>
                <span className="text-sm text-gray-500">3</span>
              </div>

              <div className="space-y-3">
                <button
                  onClick={onCreateNote}
                  className="w-full bg-white dark:bg-[#1f2029] p-3 rounded-2xl flex items-center justify-between border border-transparent hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-md active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-green-600 dark:text-green-400" strokeWidth={2} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                        新建笔记
                      </p>
                      <p className="text-[10px] text-gray-500">快速创建</p>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>

                <button
                  onClick={() => onNavigate('favorites')}
                  className="w-full bg-white dark:bg-[#1f2029] p-3 rounded-2xl flex items-center justify-between border border-transparent hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-md active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400" strokeWidth={2} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                        我的收藏
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {stats.favoriteNotes} 篇笔记
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>

                <button
                  onClick={() => onNavigate('calendar')}
                  className="w-full bg-white dark:bg-[#1f2029] p-3 rounded-2xl flex items-center justify-between border border-transparent hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-md active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                        日历视图
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {stats.upcomingReminders} 个提醒
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
              </div>
            </div>

            {/* 最近笔记区域 */}
            <div className="relative z-10 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex-1 flex flex-col min-h-0">
              {/* 笔记列表 - 可滚动 */}
              <div className="flex-1 overflow-y-auto -mx-2 px-2">
                <RecentActivityCard
                  recentNotes={stats.recentNotes}
                  className="bg-transparent border-0 shadow-none p-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
