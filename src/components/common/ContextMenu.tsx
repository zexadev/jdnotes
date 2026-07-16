import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface ContextMenuItem {
  icon: LucideIcon
  label: string
  hint?: string
  disabled?: boolean
  onSelect: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

// 应用自绘右键菜单（桌面软件不放行网页原生菜单）。
// 菜单项 mousedown 必须 preventDefault：否则点击瞬间选区被清掉，复制/剪切就空了
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onBlur = () => onClose()
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onBlur)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onBlur)
    }
  }, [onClose])

  const left = Math.max(8, Math.min(x, window.innerWidth - 184))
  const top = Math.max(8, Math.min(y, window.innerHeight - items.length * 32 - 16))

  return (
    <div
      ref={ref}
      className="fixed z-[200] min-w-[168px] py-1 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 animate-in fade-in zoom-in-95 duration-100 select-none"
      style={{ left, top }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-[#5E6AD2]/10 hover:text-[#5E6AD2] disabled:opacity-35 disabled:pointer-events-none transition-colors"
        >
          <item.icon className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
          <span className="flex-1 text-left">{item.label}</span>
          {item.hint && (
            <kbd className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">{item.hint}</kbd>
          )}
        </button>
      ))}
    </div>
  )
}
