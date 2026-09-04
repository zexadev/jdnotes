import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { NoteCard } from '../common/NoteCard'
import { NoNotesState, NoSearchResultState } from '../common/EmptyState'
import { NoteCardSkeleton } from '../common/Skeleton'
import type { Note } from '../../lib/db'

interface NoteListProps {
  searchQuery: string
  onClearSearch: () => void
  currentView: string
  notes: Note[]
  activeNoteId: number | null
  isLoading?: boolean
  onSelectNote: (note: Note) => void
  onCreateNote: () => void
  onDeleteNote: (id: number) => void
  onRestoreNote: (id: number) => void
  onPermanentDelete: (id: number) => void
  onBatchDelete: (ids: number[]) => void
  onBatchRestore: (ids: number[]) => void
  onBatchPermanentDelete: (ids: number[]) => void
}

export function NoteList({
  searchQuery,
  onClearSearch,
  currentView,
  notes,
  activeNoteId,
  isLoading = false,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onRestoreNote,
  onPermanentDelete,
  onBatchDelete,
  onBatchRestore,
  onBatchPermanentDelete,
}: NoteListProps) {
  const isTrash = currentView === 'trash'
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showPermDeleteConfirm, setShowPermDeleteConfirm] = useState(false)

  // 切换视图 / 搜索时退出多选，避免选中项跨视图错乱
  useEffect(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [currentView, searchQuery])

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = notes.length > 0 && selectedIds.size === notes.length
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(notes.map((n) => n.id)))
  }

  const ids = () => Array.from(selectedIds)
  const doBatchDelete = () => {
    if (selectedIds.size === 0) return
    onBatchDelete(ids())
    exitSelection()
  }
  const doBatchRestore = () => {
    if (selectedIds.size === 0) return
    onBatchRestore(ids())
    exitSelection()
  }
  const doBatchPermDelete = () => {
    onBatchPermanentDelete(ids())
    setShowPermDeleteConfirm(false)
    exitSelection()
  }

  return (
    <div className="w-full md:w-[320px] bg-[#F9FBFC] dark:bg-[#0B0D11] md:border-r border-black/[0.03] dark:border-white/[0.06] flex flex-col transition-colors duration-300">
      {/* 列表头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.03] dark:border-white/[0.06]">
        {selectionMode ? (
          <>
            <button
              onClick={exitSelection}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] rounded-lg transition-colors"
            >
              取消
            </button>
            <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">已选 {selectedIds.size}</span>
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 text-xs font-medium text-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 rounded-lg transition-colors"
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {searchQuery
                ? `搜索: "${searchQuery}"`
                : currentView === 'inbox'
                  ? '全部笔记'
                  : currentView === 'favorites'
                    ? '收藏'
                    : isTrash
                      ? '废纸篓'
                      : currentView.startsWith('tag-')
                        ? `标签: ${currentView.slice(4)}`
                        : '全部笔记'}
            </h2>
            <div className="flex items-center gap-1">
              {notes.length > 0 && (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] rounded-md transition-colors"
                >
                  选择
                </button>
              )}
              {!isTrash && (
                <button
                  onClick={onCreateNote}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/[0.03] transition-colors duration-200 btn-press"
                  title="新建笔记"
                >
                  <Plus className="h-4 w-4 text-slate-600 dark:text-slate-400" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectionMode && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-black/[0.03] dark:border-white/[0.06] bg-black/[0.015] dark:bg-white/[0.02]">
          {isTrash ? (
            <>
              <button
                onClick={doBatchRestore}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 text-xs font-medium text-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 rounded-lg transition-colors disabled:opacity-40"
              >
                恢复
              </button>
              <button
                onClick={() => setShowPermDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-40"
              >
                彻底删除
              </button>
            </>
          ) : (
            <button
              onClick={doBatchDelete}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-40"
            >
              删除
            </button>
          )}
        </div>
      )}

      {/* 笔记列表。overflow-x-hidden：卡片 hover 放大(scale 1.01)的 transform 包围盒会超出容器宽度，
          不裁掉会在列表底部挤出横向滚动条 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <>
            <NoteCardSkeleton />
            <NoteCardSkeleton />
            <NoteCardSkeleton />
          </>
        ) : !notes || notes.length === 0 ? (
          searchQuery.trim() ? (
            <NoSearchResultState query={searchQuery} onClear={onClearSearch} />
          ) : (
            <NoNotesState onCreateNote={onCreateNote} />
          )
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
                isTrashView={isTrash}
                selectionMode={selectionMode}
                selected={selectedIds.has(note.id)}
                onToggleSelect={() => toggleSelect(note.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* 批量彻底删除确认弹窗（不可逆，必须确认） */}
      {showPermDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPermDeleteConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              彻底删除 {selectedIds.size} 条笔记？
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              将从本机永久删除，<span className="text-red-500">无法恢复</span>。注意：若其它已配对设备仍持有这些笔记，下次同步可能把它们重新同步回来。
            </p>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button
                onClick={() => setShowPermDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={doBatchPermDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                彻底删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
