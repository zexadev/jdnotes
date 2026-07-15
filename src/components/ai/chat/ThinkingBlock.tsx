import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Brain } from 'lucide-react'

interface ThinkingBlockProps {
  content: string
  /** 已封口的思考时长；undefined 且 streaming 时表示思考进行中 */
  durationMs?: number
  streaming?: boolean
}

function formatDuration(ms: number): string {
  const s = ms / 1000
  if (s < 1) return '不到 1 秒'
  if (s < 10) return `${s.toFixed(1)} 秒`
  return `${Math.round(s)} 秒`
}

// 思考过程显示：默认折叠为一行（思考中… shimmer / 已思考 N 秒），点击展开灰字全文。
// 思考进行中展开时用 column-reverse 让最新内容贴底可见（Cursor 式跟随）。
export const ThinkingBlock = memo(function ThinkingBlock({ content, durationMs, streaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const active = streaming && durationMs === undefined

  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-0.5 text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors select-none"
      >
        <ChevronRight
          className={`h-3 w-3 flex-shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          strokeWidth={1.5}
        />
        <Brain className="h-3 w-3 flex-shrink-0" strokeWidth={1.5} />
        {active ? (
          <span className="ai-shimmer-text">思考中…</span>
        ) : (
          <span>{durationMs !== undefined ? `已思考 ${formatDuration(durationMs)}` : '思考过程'}</span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className={`ml-[5px] mt-1 pl-3 border-l-2 border-black/[0.05] dark:border-white/[0.08] text-[12px] leading-relaxed text-slate-400 dark:text-slate-500 whitespace-pre-wrap break-words max-h-40 overflow-y-auto ${
                active ? 'flex flex-col-reverse' : ''
              }`}
            >
              {/* column-reverse 容器里单个子元素顺序不变，滚动锚点贴底 */}
              <div>{content}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
