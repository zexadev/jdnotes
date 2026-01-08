import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Eye, PenLine, Sparkles, Bell, X } from 'lucide-react'
import { Editor } from '../editor'
import { TagsInput, EmptyState } from '../common'
import { formatDate } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { formatTimeRemaining } from '../calendar/ReminderNotification'
import type { Note } from '../../lib/db'

interface MainContentProps {
  activeNoteId: number | null
  activeNote: Note | null
  localTitle: string
  localContent: string
  isEditing: boolean
  isChatOpen: boolean
  contentToInsert: string | null
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onTagsChange: (tags: string[]) => void
  onToggleFavorite: (id: number) => void
  onToggleEdit: () => void
  onToggleChat: () => void
  onCreateNote: () => void
  onContentInserted: () => void
  onSetReminder?: (noteId: number, reminderDate: Date) => void
  onClearReminder?: (noteId: number) => void
}

export function MainContent({
  activeNoteId,
  activeNote,
  localTitle,
  localContent,
  isEditing,
  isChatOpen,
  contentToInsert,
  onTitleChange,
  onContentChange,
  onTagsChange,
  onToggleFavorite,
  onToggleEdit,
  onToggleChat,
  onCreateNote,
  onContentInserted,
  onSetReminder,
  onClearReminder,
}: MainContentProps) {
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const reminderButtonRef = useRef<HTMLButtonElement>(null)
  const reminderPopupRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭提醒选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showReminderPicker &&
        reminderPopupRef.current &&
        !reminderPopupRef.current.contains(event.target as Node) &&
        reminderButtonRef.current &&
        !reminderButtonRef.current.contains(event.target as Node)
      ) {
        setShowReminderPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showReminderPicker])

  const hasReminder = activeNote?.reminderEnabled === 1 && activeNote?.reminderDate

  return (
    <main className="flex-1 bg-[#F9FBFC] dark:bg-[#0B0D11] h-full overflow-hidden flex flex-col transition-colors duration-300">
      <AnimatePresence mode="wait">
        {activeNoteId !== null ? (
          <motion.div
            key={activeNoteId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* 编辑器头部 - 毛玻璃效果 */}
            <div className="flex items-center justify-between px-12 py-4 border-b border-black/[0.03] dark:border-white/[0.06] editor-header-glass sticky top-0 z-10">
              <nav className="text-[13px] text-slate-400">
                <span className="hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors">
                  全部笔记
                </span>
                <span className="mx-2">/</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {localTitle || '无标题'}
                </span>
              </nav>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-400">
                  最后编辑于 {formatDate(activeNote?.updatedAt ?? new Date())}
                </span>
                {/* 收藏按钮 */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => activeNoteId && onToggleFavorite(activeNoteId)}
                  className={`p-1.5 rounded-lg transition-colors duration-200 ${
                    activeNote?.isFavorite === 1
                      ? 'text-[#5E6AD2] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
                      : 'text-slate-400 hover:text-[#5E6AD2] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
                  }`}
                  title={activeNote?.isFavorite === 1 ? '取消收藏' : '收藏'}
                >
                  <Star
                    className={`h-4 w-4 ${activeNote?.isFavorite === 1 ? 'fill-[#5E6AD2]' : ''}`}
                    strokeWidth={1.5}
                  />
                </motion.button>
                {/* 提醒按钮 */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    ref={reminderButtonRef}
                    onClick={() => setShowReminderPicker(!showReminderPicker)}
                    className={`p-1.5 rounded-lg transition-colors duration-200 ${
                      hasReminder
                        ? 'text-amber-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
                        : 'text-slate-400 hover:text-amber-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
                    }`}
                    title={hasReminder ? '查看/修改提醒' : '设置提醒'}
                  >
                    <Bell
                      className={`h-4 w-4 ${hasReminder ? 'fill-amber-500' : ''}`}
                      strokeWidth={1.5}
                    />
                  </motion.button>
                  {/* 提醒选择器弹出框 */}
                  {showReminderPicker && (
                    <div
                      ref={reminderPopupRef}
                      className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-black/[0.06] dark:border-white/[0.06] p-4 z-50"
                    >
                      <ReminderPickerPopup
                        noteId={activeNoteId}
                        hasReminder={!!hasReminder}
                        reminderDate={activeNote?.reminderDate}
                        onSetReminder={(date) => {
                          onSetReminder?.(activeNoteId, date)
                          setShowReminderPicker(false)
                        }}
                        onClearReminder={() => {
                          onClearReminder?.(activeNoteId)
                          setShowReminderPicker(false)
                        }}
                        onClose={() => setShowReminderPicker(false)}
                      />
                    </div>
                  )}
                </div>
                {/* 模式切换按钮 */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onToggleEdit}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors duration-200"
                  title={isEditing ? '切换到阅读模式' : '切换到编辑模式'}
                >
                  {isEditing ? (
                    <Eye className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <PenLine className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </motion.button>
                {/* AI 助手按钮 */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onToggleChat}
                  className={`p-1.5 rounded-lg transition-colors duration-200 ${
                    isChatOpen
                      ? 'text-[#5E6AD2] bg-[#5E6AD2]/10'
                      : 'text-slate-400 hover:text-[#5E6AD2] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
                  }`}
                  title="AI 助手 (⌘J)"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                </motion.button>
              </div>
            </div>

            {/* 标签输入区域 */}
            <div className="px-12 py-2 border-b border-black/[0.03] dark:border-white/[0.06]">
              <TagsInput
                tags={activeNote?.tags ?? []}
                onChange={onTagsChange}
                disabled={!isEditing}
              />
            </div>

            {/* Tiptap 编辑器 */}
            <Editor
              key={`editor-${activeNoteId}`}
              title={localTitle}
              content={localContent}
              tags={activeNote?.tags ?? []}
              isEditing={isEditing}
              createdAt={activeNote?.createdAt ?? new Date()}
              updatedAt={activeNote?.updatedAt ?? new Date()}
              onTitleChange={onTitleChange}
              onContentChange={onContentChange}
              onTagsChange={onTagsChange}
              contentToInsert={contentToInsert}
              onContentInserted={onContentInserted}
            />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col h-full"
          >
            <EmptyState onCreateNote={onCreateNote} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

// 提醒选择器弹出组件
interface ReminderPickerPopupProps {
  noteId: number
  hasReminder: boolean
  reminderDate?: Date
  onSetReminder: (date: Date) => void
  onClearReminder: () => void
  onClose: () => void
}

function ReminderPickerPopup({
  hasReminder,
  reminderDate,
  onSetReminder,
  onClearReminder,
  onClose,
}: ReminderPickerPopupProps) {
  const [selectedTime, setSelectedTime] = useState('')

  const quickOptions = [
    { label: '30分钟后', minutes: 30 },
    { label: '1小时后', minutes: 60 },
    { label: '3小时后', minutes: 180 },
    { label: '明天此时', minutes: 24 * 60 },
  ]

  const handleQuickSelect = (minutes: number) => {
    const date = new Date(Date.now() + minutes * 60 * 1000)
    onSetReminder(date)
    // 显示 toast 提示
    const remaining = formatTimeRemaining(date)
    toast.success(`⏰ 将在 ${remaining} 后提醒`)
  }

  const handleCustomTime = () => {
    if (!selectedTime) return
    const [hours, minutes] = selectedTime.split(':').map(Number)
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    if (date <= new Date()) {
      date.setDate(date.getDate() + 1)
    }
    onSetReminder(date)
    setSelectedTime('')
    // 显示 toast 提示
    const remaining = formatTimeRemaining(date)
    toast.success(`⏰ 将在 ${remaining} 后提醒`)
  }

  return (
    <div className="space-y-3">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {hasReminder ? '已设置提醒' : '设置提醒'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded"
        >
          <X className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
        </button>
      </div>

      {/* 已有提醒显示 */}
      {hasReminder && reminderDate && (
        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
          <div className="text-[13px] text-amber-700 dark:text-amber-400 mb-2">
            提醒时间：{new Date(reminderDate).toLocaleString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <button
            onClick={onClearReminder}
            className="text-[12px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
          >
            取消提醒
          </button>
        </div>
      )}

      {/* 分隔线 */}
      {hasReminder && (
        <div className="border-t border-black/[0.06] dark:border-white/[0.06] pt-3">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider">修改提醒</span>
        </div>
      )}

      {/* 快捷选项 */}
      <div className="grid grid-cols-2 gap-2">
        {quickOptions.map((option) => (
          <button
            key={option.label}
            onClick={() => handleQuickSelect(option.minutes)}
            className="py-2 text-[13px] text-slate-600 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 自定义时间 */}
      <div className="flex gap-2">
        <input
          type="time"
          value={selectedTime}
          onChange={(e) => setSelectedTime(e.target.value)}
          className="flex-1 px-3 py-2 text-[13px] bg-slate-50 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] rounded-lg outline-none focus:border-amber-500/50"
        />
        <button
          onClick={handleCustomTime}
          disabled={!selectedTime}
          className="px-3 py-2 text-[13px] text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          确定
        </button>
      </div>
    </div>
  )
}
