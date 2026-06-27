import { useState, useEffect, useRef, useMemo } from 'react'
import { FileText, Link2 } from 'lucide-react'

export interface NoteRefItem {
  id: number
  uuid?: string
  title: string
}

interface NoteRefMenuProps {
  notes: NoteRefItem[]
  query: string
  currentNoteId: number | null
  position: { top: number; left: number }
  onSelect: (note: NoteRefItem) => void
  onClose: () => void
}

const MAX_RESULTS = 50

export function NoteRefMenu({ notes, query, currentNoteId, position, onSelect, onClose }: NoteRefMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // 只引用有 uuid（可跨设备稳定定位）的笔记，排除当前笔记自身；按标题过滤
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter((n) => n.uuid && n.id !== currentNoteId)
      .filter((n) => (q ? (n.title || '').toLowerCase().includes(q) : true))
      .slice(0, MAX_RESULTS)
  }, [notes, query, currentNoteId])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // 键盘导航：用捕获阶段 + stopPropagation 抢在 ProseMirror（挂在 view.dom 的冒泡监听）之前
  // 吃掉 上下/Enter/Esc，避免 Enter 被编辑器当成换行先处理掉（那会触发菜单关闭、导致选不中）。
  // 可打印字符不拦截，照常流入编辑器，由 hook 从文档更新 query。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [filtered, selectedIndex, onSelect, onClose])

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 py-1 bg-white dark:bg-[#16181D] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
        <Link2 className="h-3 w-3" />
        <span>引用笔记</span>
        {query && <span className="text-indigo-500 font-medium truncate">{query}</span>}
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-[13px] text-gray-400 dark:text-gray-500">
            {query ? '没有匹配的笔记' : '没有可引用的笔记'}
          </div>
        ) : (
          filtered.map((note, index) => (
            <button
              key={note.id}
              ref={index === selectedIndex ? selectedItemRef : null}
              onClick={() => onSelect(note)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-indigo-50 dark:bg-indigo-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                  index === selectedIndex
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                }`}
              >
                <FileText className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13px] font-medium truncate ${
                    index === selectedIndex
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {note.title || '未命名笔记'}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span>↑↓ 选择 · Enter 确认 · Esc 取消</span>
        <span>[[ 引用</span>
      </div>
    </div>
  )
}
