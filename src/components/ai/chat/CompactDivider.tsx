import { useState } from 'react'
import { ChevronRight, FoldVertical, Trash2 } from 'lucide-react'
import { MarkdownContent } from './MarkdownContent'

interface CompactDividerProps {
  summary: string
  // 删除压缩点 = 恢复携带压缩点之前的完整历史
  onDelete?: () => void
}

// 上下文压缩点分隔线：常态一条细线+「上下文已压缩」，点击展开摘要正文
export function CompactDivider({ summary, onDelete }: CompactDividerProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="my-3 group">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/70" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
          title="此处之前的对话已压缩成摘要发送给模型，点击查看摘要"
        >
          <FoldVertical className="h-3 w-3" strokeWidth={1.5} />
          上下文已压缩
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} strokeWidth={1.5} />
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 md:p-0.5 text-slate-300 dark:text-slate-600 hover:text-red-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
            title="删除压缩点（恢复携带完整历史）"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
          </button>
        )}
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/70" />
      </div>
      {expanded && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
          <MarkdownContent content={summary} />
        </div>
      )}
    </div>
  )
}
