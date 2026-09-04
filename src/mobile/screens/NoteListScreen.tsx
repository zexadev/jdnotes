import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Note } from '../../lib/db'
import { extractPreview, formatDate } from '../../lib/utils'
import { tagColor } from '../../lib/tagColor'

interface NoteListScreenProps {
  notes: Note[]
  onOpen: (id: number) => void
  onCompose: () => void
}

export function NoteListScreen({ notes, onOpen, onCompose }: NoteListScreenProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    )
  }, [notes, query])

  return (
    <div className="flex h-full flex-col">
      <header className="px-5 pt-3 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">Lapis</h1>
          <span className="text-[12px] text-slate-400 dark:text-slate-500">{notes.length} 篇</span>
        </div>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索"
            className="h-11 w-full rounded-xl bg-black/[0.04] pl-10 pr-4 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 dark:bg-white/[0.06] dark:text-slate-100"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-1">
        {visible.length === 0 ? (
          <EmptyState searching={query.trim().length > 0} />
        ) : (
          visible.map((note) => <NoteRow key={note.id} note={note} onClick={() => onOpen(note.id)} />)
        )}
      </div>

      <button
        onClick={onCompose}
        className="press fixed bottom-6 right-5 h-12 rounded-full bg-accent px-6 text-[15px] font-medium text-white shadow-lg shadow-accent/30"
      >
        速记
      </button>
    </div>
  )
}

function NoteRow({ note, onClick }: { note: Note; onClick: () => void }) {
  const preview = extractPreview(note.content)
  return (
    <button
      onClick={onClick}
      className="press mb-2.5 block w-full rounded-2xl border border-black/[0.04] bg-white px-4 py-3.5 text-left dark:border-white/[0.06] dark:bg-dark-card"
    >
      <div className="line-clamp-1 text-[16px] font-medium text-slate-900 dark:text-slate-100">
        {note.title || '无标题'}
      </div>
      {preview && (
        <div className="mt-1 line-clamp-2 text-[13.5px] leading-[1.5] text-slate-500 dark:text-slate-400">
          {preview}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[12px] text-slate-400 dark:text-slate-500">{formatDate(note.updatedAt)}</span>
        {note.tags.slice(0, 3).map((tag) => {
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
    </button>
  )
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center pb-16 text-center">
      <div className="text-[15px] text-slate-500 dark:text-slate-400">{searching ? '没有匹配的笔记' : '还没有笔记'}</div>
      {!searching && (
        <div className="mt-1.5 text-[13px] text-slate-400 dark:text-slate-500">在电脑上配对同步，或点右下角速记。</div>
      )}
    </div>
  )
}
