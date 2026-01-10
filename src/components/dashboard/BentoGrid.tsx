import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface BentoGridProps {
  children: ReactNode;
}

/**
 * 便当盒风格的网格布局容器
 * 使用 CSS Grid 实现灵活的卡片排列
 */
export function BentoGrid({ children }: BentoGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ staggerChildren: 0.1 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[180px] gap-4"
    >
      {children}
    </motion.div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  gradient?: string;
}

/**
 * 便当盒卡片基础组件
 * 提供统一的卡片样式、动画和交互效果
 */
export function BentoCard({ children, className = '', onClick, gradient }: BentoCardProps) {
  const baseClasses = `
    relative rounded-2xl overflow-hidden
    bg-white dark:bg-[#1C1E23]
    backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.06]
    transition-all duration-300
    hover:border-black/[0.12] dark:hover:border-white/[0.08]
    hover:shadow-xl dark:hover:shadow-lg dark:hover:shadow-black/20
    ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
    ${className}
  `;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={onClick ? { y: -4 } : {}}
      className={baseClasses}
      onClick={onClick}
    >
      {/* 渐变背景装饰 */}
      {gradient && (
        <div
          className={`absolute inset-0 opacity-5 ${gradient}`}
          style={{ mixBlendMode: 'soft-light' }}
        />
      )}

      {/* 边缘光晕效果 */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent" />

      {/* 内容 */}
      <div className="relative z-10 h-full">
        {children}
      </div>
    </motion.div>
  );
}
