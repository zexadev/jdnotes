import { useState } from 'react'
import { noteOperations } from '../../lib/db'

interface ComposeScreenProps {
  onBack: () => void
  onCreated: () => Promise<void>
}

// 每条速记新建独立笔记（不用单一 inbox 追加——多端并发尾部追加会撞冲突副本）。
// 标题可不填：取正文第一行，再没有就按时间起名
function fallbackTitle(content: string): string {
  const firstLine = content
    .split('\n')
    .map((l) => l.replace(/^[#>\-*\s]+/, '').trim())
    .find((l) => l.length > 0)
  if (firstLine) return firstLine.slice(0, 40)
  const d = new Date()
  return `速记 ${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ComposeScreen({ onBack, onCreated }: ComposeScreenProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = content.trim().length > 0 || title.trim().length > 0

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      await noteOperations.create(title.trim() || fallbackTitle(content), content)
      await onCreated()
      onBack()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={onBack}
          className="press h-9 rounded-lg bg-black/[0.05] px-3.5 text-[14px] font-medium text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
        >
          取消
        </button>
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="press h-9 rounded-lg bg-accent px-4 text-[14px] font-medium text-white disabled:opacity-40"
        >
          保存
        </button>
      </header>
      <div className="flex flex-1 flex-col overflow-hidden px-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（可不填）"
          className="h-11 w-full bg-transparent text-[20px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写点什么"
          className="mt-1 w-full flex-1 resize-none bg-transparent pb-6 text-[16px] leading-[1.7] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200"
        />
      </div>
    </div>
  )
}
