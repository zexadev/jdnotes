import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { BentoCard } from './BentoGrid';

interface HeatmapCardProps {
  className?: string;
  distribution: Map<string, number>;
  onNavigate: (view: 'calendar' | 'inbox' | 'favorites') => void;
}

export function HeatmapCard({ className, distribution, onNavigate }: HeatmapCardProps) {
  // 获取最近 12 周的数据
  const weeks = 12;
  const days = weeks * 7;
  const today = new Date();

  const heatmapData: { date: Date; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    const count = distribution.get(dateKey) || 0;
    heatmapData.push({ date, count });
  }

  // 计算最大值用于颜色强度
  const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

  // 获取颜色强度
  const getIntensity = (count: number): string => {
    if (count === 0) return 'bg-slate-200 dark:bg-white/5';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'bg-[#5E6AD2]/20';
    if (intensity < 0.5) return 'bg-[#5E6AD2]/40';
    if (intensity < 0.75) return 'bg-[#5E6AD2]/60';
    return 'bg-[#5E6AD2]/80';
  };

  // 按周分组
  const weekData: { date: Date; count: number }[][] = [];
  for (let i = 0; i < heatmapData.length; i += 7) {
    weekData.push(heatmapData.slice(i, i + 7));
  }

  return (
    <BentoCard className={className} onClick={() => onNavigate('calendar')}>
      <div className="p-6 h-full flex flex-col">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">写作活跃度</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">最近 {weeks} 周</p>
          </div>
          <Calendar className="w-5 h-5 text-slate-400 dark:text-gray-400" />
        </div>

        {/* 热力图 */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex gap-[3px]">
            {weekData.map((week, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {week.map((day, dayIdx) => (
                  <motion.div
                    key={`${weekIdx}-${dayIdx}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (weekIdx * 7 + dayIdx) * 0.005 }}
                    whileHover={{ scale: 1.5, zIndex: 10 }}
                    className={`w-3 h-3 rounded-sm ${getIntensity(day.count)}
                              transition-all duration-200 cursor-pointer
                              hover:ring-2 hover:ring-[#5E6AD2]/50`}
                    title={`${day.date.toLocaleDateString('zh-CN')}: ${day.count} 篇`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 图例 */}
        <div className="flex items-center justify-between mt-4 text-xs text-slate-500 dark:text-gray-500">
          <span>较少</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-white/5" />
            <div className="w-3 h-3 rounded-sm bg-[#5E6AD2]/20" />
            <div className="w-3 h-3 rounded-sm bg-[#5E6AD2]/40" />
            <div className="w-3 h-3 rounded-sm bg-[#5E6AD2]/60" />
            <div className="w-3 h-3 rounded-sm bg-[#5E6AD2]/80" />
          </div>
          <span>较多</span>
        </div>
      </div>
    </BentoCard>
  );
}
