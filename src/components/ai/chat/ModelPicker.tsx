import { useRef, useState, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { AISource } from '../../../hooks/useSettings'
import { inferContextWindow } from '../../../lib/contextBudget'

interface ModelPickerProps {
  sources: AISource[]
  activeSourceId: string
  onSelect: (id: string) => void
}

function formatWindow(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}M` : `${Math.round(n / 1000)}k`
}

// 输入卡底行的模型选择器：向上弹出，列表带 provider 模型名与上下文窗口
export function ModelPicker({ sources, activeSourceId, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const active = sources.find((s) => s.id === activeSourceId)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 max-w-[150px] text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#5E6AD2] transition-colors"
        title={active ? `${active.name} · ${active.model}` : '选择模型'}
      >
        <span className="truncate">{active?.name || 'AI'}</span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>

      {open && sources.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-60 py-1 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          {sources.map((source) => {
            const win = source.contextWindow || inferContextWindow(source.model)
            const isActive = source.id === activeSourceId
            return (
              <button
                key={source.id}
                onClick={() => {
                  onSelect(source.id)
                  setOpen(false)
                }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-[13px] leading-tight">{source.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                    <span className="truncate">{source.model}</span>
                    <span className="flex-shrink-0 px-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-[10px] tabular-nums">
                      {formatWindow(win)}
                    </span>
                  </div>
                </div>
                {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
