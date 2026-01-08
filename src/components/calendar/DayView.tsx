import { useMemo, useState } from 'react'
import { Clock, Bell, Calendar, X } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { isSameDay, formatCalendarTime } from '../../hooks/useCalendar'
import type { Note } from '../../lib/db'

interface DayViewProps {
  currentDate: Date
  notes: Note[]
  dateField: 'createdAt' | 'updatedAt'
  onSelectNote: (note: Note) => void
  onSetReminder?: (noteId: number, reminderDate: Date) => void
  onClearReminder?: (noteId: number) => void
}

export function DayView({
  currentDate,
  notes,
  dateField,
  onSelectNote,
  onSetReminder,
  onClearReminder,
}: DayViewProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)

  // 设置为可放置区域
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${currentDate.toISOString()}`,
    data: { date: currentDate },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isToday = isSameDay(currentDate, today)

  // 选中的笔记详情
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null
    return notes.find((n) => n.id === selectedNoteId) || null
  }, [selectedNoteId, notes])

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`max-w-5xl mx-auto p-6 h-full overflow-auto ${
        isOver ? 'bg-[#5E6AD2]/5' : ''
      }`}
    >
      {/* 日期标题 */}
      <div
        className={`mb-6 p-6 rounded-2xl border ${
          isToday
            ? 'bg-[#5E6AD2]/5 border-[#5E6AD2]/30'
            : 'bg-white dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400 mb-1">
              {['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][currentDate.getDay()]}
            </div>
            <div className={`text-3xl font-bold ${isToday ? 'text-[#5E6AD2]' : 'text-slate-900 dark:text-slate-100'}`}>
              {currentDate.getMonth() + 1}月{currentDate.getDate()}日
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">共 {notes.length} 篇笔记</div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 笔记列表 */}
        <div className="flex-1">
          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note, index) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <NoteCard
                    note={note}
                    isSelected={selectedNoteId === note.id}
                    dateField={dateField}
                    onClick={() => setSelectedNoteId(note.id)}
                    onDoubleClick={() => onSelectNote(note)}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-white/[0.03] rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
              <Calendar className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" strokeWidth={1} />
              <div className="text-slate-400">这一天还没有笔记</div>
            </div>
          )}
        </div>

        {/* 笔记详情/提醒设置侧栏 */}
        <AnimatePresence mode="wait">
          {selectedNote && (
            <motion.div
              key={selectedNote.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-80 bg-white dark:bg-white/[0.03] rounded-xl border border-black/[0.06] dark:border-white/[0.06] p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  笔记详情
                </h3>
                <button
                  onClick={() => setSelectedNoteId(null)}
                  className="p-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded"
                >
                  <X className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-4">
                {/* 标题 */}
                <div>
                  <h4 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-2">
                    {selectedNote.title || '无标题'}
                  </h4>
                  {selectedNote.content && (
                    <p className="text-[13px] text-slate-500 line-clamp-3">
                      {selectedNote.content.replace(/<[^>]*>/g, '').substring(0, 200)}
                    </p>
                  )}
                </div>

                {/* 标签 */}
                {selectedNote.tags && selectedNote.tags.length > 0 && (
                  <div>
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-2">标签</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedNote.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 时间信息 */}
                <div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-2">时间</div>
                  <div className="space-y-1 text-[13px] text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span>创建于 {formatCalendarTime(selectedNote.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span>更新于 {formatCalendarTime(selectedNote.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* 提醒设置 */}
                <div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-2">提醒</div>
                  {selectedNote.reminderEnabled === 1 && selectedNote.reminderDate ? (
                    <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                        <span className="text-[13px] text-amber-700 dark:text-amber-400">
                          {new Date(selectedNote.reminderDate).toLocaleString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <button
                        onClick={() => onClearReminder?.(selectedNote.id)}
                        className="text-[12px] text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <ReminderPicker
                      noteId={selectedNote.id}
                      onSetReminder={onSetReminder}
                    />
                  )}
                </div>

                {/* 打开笔记按钮 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectNote(selectedNote)}
                  className="w-full py-2 text-[13px] font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors"
                >
                  打开笔记
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

interface NoteCardProps {
  note: Note
  isSelected: boolean
  dateField: 'createdAt' | 'updatedAt'
  onClick: () => void
  onDoubleClick: () => void
}

function NoteCard({ note, isSelected, dateField, onClick, onDoubleClick }: NoteCardProps) {
  return (
    <motion.div
      layout
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`
        p-4 rounded-xl border transition-all cursor-pointer
        ${isSelected
          ? 'bg-[#5E6AD2]/5 border-[#5E6AD2]/30'
          : 'bg-white dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.06] hover:border-[#5E6AD2]/30 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {note.title || '无标题'}
          </h3>
          {note.content && (
            <p className="text-sm text-slate-500 line-clamp-2">
              {note.content.replace(/<[^>]*>/g, '').substring(0, 150)}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" strokeWidth={1.5} />
              {formatCalendarTime(note[dateField] as Date)}
            </div>
            {note.tags && note.tags.length > 0 && (
              <div className="flex items-center gap-1">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {note.reminderEnabled === 1 && note.reminderDate && (
              <div className="flex items-center gap-1">
                <Bell className="h-3 w-3 text-amber-500" strokeWidth={2} />
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {new Date(note.reminderDate).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface ReminderPickerProps {
  noteId: number
  onSetReminder?: (noteId: number, reminderDate: Date) => void
}

function ReminderPicker({ noteId, onSetReminder }: ReminderPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [selectedTime, setSelectedTime] = useState('')

  const quickOptions = [
    { label: '30分钟后', minutes: 30 },
    { label: '1小时后', minutes: 60 },
    { label: '3小时后', minutes: 180 },
    { label: '明天此时', minutes: 24 * 60 },
  ]

  const handleQuickSelect = (minutes: number) => {
    const reminderDate = new Date(Date.now() + minutes * 60 * 1000)
    onSetReminder?.(noteId, reminderDate)
    setShowPicker(false)
  }

  const handleCustomTime = () => {
    if (!selectedTime) return
    const [hours, minutes] = selectedTime.split(':').map(Number)
    const reminderDate = new Date()
    reminderDate.setHours(hours, minutes, 0, 0)
    if (reminderDate <= new Date()) {
      reminderDate.setDate(reminderDate.getDate() + 1)
    }
    onSetReminder?.(noteId, reminderDate)
    setShowPicker(false)
    setSelectedTime('')
  }

  if (!showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="w-full py-2 text-[13px] text-slate-500 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/5 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Bell className="h-4 w-4" strokeWidth={1.5} />
        设置提醒
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {/* 快捷选项 */}
      <div className="grid grid-cols-2 gap-2">
        {quickOptions.map((option) => (
          <button
            key={option.label}
            onClick={() => handleQuickSelect(option.minutes)}
            className="py-1.5 text-[12px] text-slate-600 dark:text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/5 rounded-lg transition-colors"
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
          className="flex-1 px-3 py-1.5 text-[13px] bg-slate-50 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] rounded-lg outline-none focus:border-[#5E6AD2]/30"
        />
        <button
          onClick={handleCustomTime}
          disabled={!selectedTime}
          className="px-3 py-1.5 text-[13px] text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          确定
        </button>
      </div>

      <button
        onClick={() => setShowPicker(false)}
        className="w-full py-1.5 text-[12px] text-slate-400 hover:text-slate-600"
      >
        取消
      </button>
    </div>
  )
}
