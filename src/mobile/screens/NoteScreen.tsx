import { useEffect, useState } from 'react'
import { noteOperations, type Note } from '../../lib/db'
import { formatDateTime } from '../../lib/utils'
import { tagColor } from '../../lib/tagColor'
import { MarkdownView } from '../components/MarkdownView'

interface NoteScreenProps {
  note: Note
  onBack: () => void
  onChanged: () => Promise<void>
  onOpenNote: (uuid: string) => void
}

// 阅读态 react-markdown 只读渲染；编辑态是纯 textarea 改 Markdown 源码——
// 手机上 contenteditable 系编辑器（Tiptap/CM6 Live Preview）中文输入法坑深，textarea 是 IME 最稳的路
export function NoteScreen({ note, onBack, onChanged, onOpenNote }: NoteScreenProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    setEditing(false)
  }, [note.id, note.title, note.content])

  const dirty = title !== note.title || content !== note.content

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      await noteOperations.update(note.id, { title: title.trim() || '无标题', content })
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  const finishEditing = async () => {
    await save()
    setEditing(false)
  }

  const handleBack = async () => {
    if (editing) await save()
    onBack()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={handleBack}
          className="press h-9 rounded-lg bg-black/[0.05] px-3.5 text-[14px] font-medium text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
        >
          返回
        </button>
        {editing ? (
          <button
            onClick={finishEditing}
            disabled={saving}
            className="press h-9 rounded-lg bg-accent px-4 text-[14px] font-medium text-white disabled:opacity-50"
          >
            完成
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="press h-9 rounded-lg bg-accent px-4 text-[14px] font-medium text-white"
          >
            编辑
          </button>
        )}
      </header>

      {editing ? (
        <div className="flex flex-1 flex-col overflow-hidden px-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题"
            className="h-11 w-full bg-transparent text-[20px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="正文（Markdown）"
            className="mt-1 w-full flex-1 resize-none bg-transparent pb-6 text-[16px] leading-[1.7] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          <h1 className="text-[22px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {note.title || '无标题'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-slate-400 dark:text-slate-500">{formatDateTime(note.updatedAt)}</span>
            {note.tags.map((tag) => {
              const c = tagColor(tag)
              return (
                <span
                  key={tag}
                  className="rounded-md px-1.5 py-0.5 text-[11px] leading-none"
                  style={{ color: c.base, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                >
                  {tag}
                </span>
              )
            })}
          </div>
          <div className="mt-4">
            <MarkdownView content={note.content} onOpenNote={onOpenNote} />
          </div>
        </div>
      )}
    </div>
  )
}
