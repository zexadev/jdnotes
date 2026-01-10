import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  title: string;
  value: number | string;
  unit?: string;
  subtitle?: string;
  trend?: number;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  icon: Icon,
  title,
  value,
  unit,
  subtitle,
  trend,
  className = '',
  onClick,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      onClick={onClick}
      className={`bg-gray-100 dark:bg-[#161722] rounded-[2rem] p-6 flex flex-col justify-between flex-1 relative overflow-hidden group hover:shadow-xl transition-shadow duration-300 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* 内容 */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 dark:bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <Icon className="h-5 w-5 text-gray-700 dark:text-gray-300" strokeWidth={2} />
            </div>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-semibold mt-1 text-gray-900 dark:text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span className="text-lg align-top text-gray-500 ml-1">{unit}</span>}
          </h3>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>

        {/* 趋势标签 */}
        {trend !== undefined && (
          <span
            className={`px-3 py-1.5 text-xs font-bold rounded-full ${
              trend >= 0
                ? 'bg-green-900/40 text-green-400'
                : 'bg-red-400 text-white'
            }`}
          >
            {trend > 0 ? '+' : ''}
            {trend.toFixed(1)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}
