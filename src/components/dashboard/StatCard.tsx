import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { BentoCard } from './BentoGrid';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: number | string;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  color: 'blue' | 'yellow' | 'purple' | 'green' | 'orange';
  className?: string;
  onClick?: () => void;
  pulse?: boolean;
}

const colorMap = {
  blue: {
    icon: 'text-blue-500 dark:text-blue-400',
    bg: 'bg-blue-500/10 dark:bg-blue-500/10',
    gradient: 'from-blue-500/20 to-blue-600/20',
    border: 'border-blue-500/20 dark:border-blue-500/20',
  },
  yellow: {
    icon: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-500/10 dark:bg-yellow-500/10',
    gradient: 'from-yellow-500/20 to-yellow-600/20',
    border: 'border-yellow-500/20 dark:border-yellow-500/20',
  },
  purple: {
    icon: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10 dark:bg-purple-500/10',
    gradient: 'from-purple-500/20 to-purple-600/20',
    border: 'border-purple-500/20 dark:border-purple-500/20',
  },
  green: {
    icon: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10 dark:bg-green-500/10',
    gradient: 'from-green-500/20 to-green-600/20',
    border: 'border-green-500/20 dark:border-green-500/20',
  },
  orange: {
    icon: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/10 dark:bg-orange-500/10',
    gradient: 'from-orange-500/20 to-orange-600/20',
    border: 'border-orange-500/20 dark:border-orange-500/20',
  },
};

export function StatCard({
  icon: Icon,
  title,
  value,
  trend,
  trendLabel,
  subtitle,
  color,
  className,
  onClick,
  pulse = false
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <BentoCard className={className} onClick={onClick}>
      <div className="p-6 h-full flex flex-col justify-between">
        {/* 图标和标题 */}
        <div className="flex items-start justify-between">
          <div
            className={`p-3 rounded-xl ${colors.bg} ${colors.border} border transition-colors duration-300`}
          >
            <Icon className={`w-5 h-5 ${colors.icon} transition-colors duration-300`} />
          </div>

          {pulse && (
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className={`w-2 h-2 rounded-full ${colors.bg.replace('/10', '')}`}
            />
          )}
        </div>

        {/* 数值和趋势 */}
        <div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-4xl font-bold text-slate-900 dark:text-white mb-2 transition-colors duration-300"
          >
            {value}
          </motion.div>

          <div className="space-y-1">
            <p className="text-sm text-slate-600 dark:text-gray-400 transition-colors duration-300">{title}</p>

            {/* 趋势指示器 */}
            {trend !== undefined && (
              <div className="flex items-center gap-1">
                {trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400 transition-colors duration-300" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400 transition-colors duration-300" />
                )}
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {trend > 0 ? '+' : ''}{trend}
                </span>
                {trendLabel && (
                  <span className="text-xs text-slate-500 dark:text-gray-500 transition-colors duration-300">{trendLabel}</span>
                )}
              </div>
            )}

            {/* 副标题 */}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-gray-500 transition-colors duration-300">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
