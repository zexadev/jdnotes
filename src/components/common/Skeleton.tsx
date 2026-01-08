import { motion } from 'framer-motion';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export function NoteCardSkeleton() {
  return (
    <div className="px-3 py-3 border-b border-black/[0.03] dark:border-white/[0.03]">
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
