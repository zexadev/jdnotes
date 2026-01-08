import { Plus } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { NoteCard } from '../common/NoteCard'
import { NoNotesState } from '../common/EmptyState'
import { NoteCardSkeleton } from '../common/Skeleton'
import type { Note } from '../../lib/db'

interface NoteListProps {
  searchQuery: string
  currentView: string
  notes: Note[]
  activeNoteId: number | null
  isLoading?: boolean
  onSelectNote: (note: Note) => void
  onCreateNote: () => void
  onDeleteNote: (id: number) => void
  onRestoreNote: (id: number) => void
  onPermanentDelete: (id: number) => void
}

export function NoteList({
  searchQuery,
  currentView,
  notes,
  activeNoteId,
  isLoading = false,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onRestoreNote,
  onPermanentDelete,
}: NoteListProps) {
  return (
    <div className="w-[320px] bg-[#F9FBFC] dark:bg-[#0B0D11] border-r border-black/[0.03] dark:border-white/[0.06] flex flex-col transition-colors duration-300">
      {/* 列表头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.03] dark:border-white/[0.06]">
        <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          {searchQuery
            ? `搜索: "${searchQuery}"`
            : currentView === 'inbox'
              ? '全部笔记'
              : currentView === 'favorites'
                ? '收藏'
                : currentView === 'trash'
                  ? '废纸篓'
                  : currentView.startsWith('tag-')
                    ? `标签: ${currentView.slice(4)}`
                    : '全部笔记'}
        </h2>
        {currentView !== 'trash' && (
          <button
            onClick={onCreateNote}
            className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.03] transition-colors duration-200 btn-press"
            title="新建笔记"
          >
            <Plus className="h-4 w-4 text-slate-600 dark:text-slate-400" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
          </>
        ) : !notes || notes.length === 0 ? (
          <NoNotesState onCreateNote={onCreateNote} />
        ) : (
          <AnimatePresence mode="popLayout">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                active={note.id === activeNoteId}
                onClick={() => onSelectNote(note)}
                onDelete={() => onDeleteNote(note.id)}
                onRestore={() => onRestoreNote(note.id)}
                onPermanentDelete={() => onPermanentDelete(note.id)}
                isTrashView={currentView === 'trash'}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
