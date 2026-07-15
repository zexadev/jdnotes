import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Copy, Check, Pencil, Unlink, CornerDownLeft } from 'lucide-react'

export interface LinkPopoverState {
  top: number
  left: number
  href: string
  // 链接 mark 的文档范围（编辑/取消链接按它操作）
  from: number
  to: number
  mode: 'view' | 'edit'
}

interface LinkPopoverProps {
  state: LinkPopoverState
  onOpen: (href: string) => void
  onApply: (href: string) => void
  onUnlink: () => void
  onModeChange: (mode: 'view' | 'edit') => void
  onClose: () => void
  // 鼠标进出卡片（悬停宽限期用）
  onMouseEnter: () => void
  onMouseLeave: () => void
}

// 链接悬停卡：查看态 = URL + 打开/复制/编辑/取消链接；编辑态 = 行内输入框。
// 与其他编辑器浮层同一套卡片语言。也承担气泡菜单「插入链接」的输入 UI（替代 WebView2 里不可用的 window.prompt）
export function LinkPopover({
  state,
  onOpen,
  onApply,
  onUnlink,
  onModeChange,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: LinkPopoverProps) {
  const [draft, setDraft] = useState(state.href)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // 进入编辑态时把草稿重置为当前 href（渲染期调整，避免 effect 级联渲染）
  const editKey = state.mode === 'edit' ? state.href : null
  const [lastEditKey, setLastEditKey] = useState<string | null>(editKey)
  if (editKey !== lastEditKey) {
    setLastEditKey(editKey)
    if (editKey !== null) setDraft(state.href)
  }

  useEffect(() => {
    if (state.mode === 'edit') {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [state.mode])

  // Esc 关闭；点击外部关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onClick)
    }
  }, [onClose])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* ignore */ }
  }

  const apply = () => {
    const href = draft.trim()
    if (!href) return
    // 没写协议默认按 https 补全
    onApply(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) ? href : `https://${href}`)
  }

  return (
    <div
      ref={rootRef}
      className="absolute z-50 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ top: state.top, left: state.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 max-w-[420px]">
        {state.mode === 'view' ? (
          <>
            <button
              onClick={() => onOpen(state.href)}
              className="min-w-0 max-w-[220px] truncate px-1.5 text-[12px] text-[#5E6AD2] hover:underline text-left"
              title={`${state.href}（点击打开）`}
            >
              {state.href}
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            <button
              onClick={() => onOpen(state.href)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 transition-colors flex-shrink-0"
              title="在浏览器打开 (Ctrl+Click)"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={copy}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                copied ? 'text-emerald-500' : 'text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10'
              }`}
              title={copied ? '已复制' : '复制链接地址'}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => onModeChange('edit')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 transition-colors flex-shrink-0"
              title="编辑链接"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onUnlink}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
              title="取消链接（保留文字）"
            >
              <Unlink className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  apply()
                }
              }}
              placeholder="输入链接地址…"
              className="w-64 px-1.5 py-0.5 text-[12px] bg-transparent outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
            <button
              onClick={apply}
              disabled={!draft.trim()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 disabled:opacity-30 transition-colors flex-shrink-0"
              title="确认 (Enter)"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
