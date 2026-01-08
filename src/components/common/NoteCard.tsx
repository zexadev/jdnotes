import { Star, Trash2, RotateCcw, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Note } from '../../lib/db'
import { formatDate, extractPreview } from '../../lib/utils'

interface NoteCardProps {
  note: Note
  active: boolean
  onClick: () => void
  onDelete: () => void
  onRestore?: () => void
  onPermanentDelete?: () => void
  isTrashView?: boolean
}

export function NoteCard({
  note,
  active,
  onClick,
  onDelete,
  onRestore,
  onPermanentDelete,
  isTrashView = false,
}: NoteCardProps) {
  const preview = extractPreview(note.content)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`note-list-item group relative w-full text-left px-3 py-3 border-b border-black/[0.03] dark:border-white/[0.06] cursor-pointer ${
        active
          ? 'note-card-active'
          : 'hover:bg-white/50 dark:hover:bg-white/[0.02]'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 pr-12">
        {note.isFavorite === 1 && (
          <Star className="h-3 w-3 text-[#5E6AD2] fill-[#5E6AD2] flex-shrink-0" />
        )}
        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate flex-shrink min-w-0 tracking-tight">
          {note.title || '无标题'}
        </h3>
        {note.tags && note.tags.length > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1 max-w-[120px] overflow-hidden">
            {note.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-black/[0.03] dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 text-[10px] rounded whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
            {note.tags.length > 2 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                +{note.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
      <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
        {preview || '空笔记'}
      </p>
      <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 block">
        {formatDate(note.updatedAt)}
      </span>

      {/* 操作按钮 */}
      <div className="absolute top-3 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
        {isTrashView ? (
          <>
            {/* 恢复按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRestore?.()
              }}
              className="p-1 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.06] btn-press"
              title="恢复笔记"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400 hover:text-green-500" strokeWidth={1.5} />
            </button>
            {/* 彻底删除按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPermanentDelete?.()
              }}
              className="p-1 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.06] btn-press"
              title="彻底删除"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" strokeWidth={1.5} />
            </button>
          </>
        ) : (
          /* 删除按钮 */
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.06] btn-press"
            title="删除笔记"
          >
            <X className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </motion.div>
  )
}
