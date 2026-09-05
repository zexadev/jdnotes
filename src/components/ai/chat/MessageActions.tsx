import { useState } from 'react'
import { Check, Copy, RotateCcw, Trash2, FileInput } from 'lucide-react'

interface MessageActionsProps {
  onCopy: () => void
  onRetry?: () => void
  onInsert?: () => void
  onDelete: () => void
  disabled?: boolean
}

// assistant 消息 hover 操作条：复制/重试/插入笔记/删除，带瞬时反馈
export function MessageActions({ onCopy, onRetry, onInsert, onDelete, disabled = false }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [inserted, setInserted] = useState(false)

  const flash = (setter: (v: boolean) => void) => {
    setter(true)
    setTimeout(() => setter(false), 1500)
  }

  const base =
    'p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="flex items-center gap-0.5 mt-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
      <button onClick={() => { onCopy(); flash(setCopied) }} className={base} title="复制" disabled={disabled}>
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
      </button>
      {onRetry && (
        <button onClick={onRetry} className={base} title="重新生成" disabled={disabled}>
          <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
        </button>
      )}
      {onInsert && (
        <button
          onClick={() => { onInsert(); flash(setInserted) }}
          className="p-2 md:p-1 rounded-md text-slate-400 hover:text-[#5E6AD2] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          title="插入到笔记"
          disabled={disabled}
        >
          {inserted ? <Check className="h-3 w-3 text-emerald-500" /> : <FileInput className="h-3 w-3" strokeWidth={1.5} />}
        </button>
      )}
      <button
        onClick={onDelete}
        className="p-2 md:p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40"
        title="删除"
        disabled={disabled}
      >
        <Trash2 className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </div>
  )
}
