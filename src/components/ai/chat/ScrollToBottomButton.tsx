import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown } from 'lucide-react'

interface ScrollToBottomButtonProps {
  visible: boolean
  onClick: () => void
}

// 脱离底部时浮现的"回到底部"按钮（绝对定位于消息区右下）
export function ScrollToBottomButton({ visible, onClick }: ScrollToBottomButtonProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          onClick={onClick}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] shadow-md text-slate-500 dark:text-slate-400 hover:text-[#5E6AD2] transition-colors"
          title="回到底部"
        >
          <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
