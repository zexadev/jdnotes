import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarCell, DraggableNote } from './CalendarCell'
import { isSameDay } from '../../hooks/useCalendar'
import { formatDateKey, type Note } from '../../lib/db'

interface MonthViewProps {
  currentDate: Date
  notes: Note[]
  distribution: Map<string, number>
  selectedDate: Date | null
  showHeatmap: boolean
  dateField: 'createdAt' | 'updatedAt'
  onSelectDate: (date: Date) => void
  onSelectNote: (note: Note) => void
}

export function MonthView({
  currentDate,
  notes,
  distribution,
  selectedDate,
  showHeatmap,
  dateField,
  onSelectDate,
  onSelectNote,
}: MonthViewProps) {
  // 按日期分组笔记
  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>()
    notes.forEach((note) => {
      const date = note[dateField] as Date
      const key = formatDateKey(date)
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(note)
    })
    return map
  }, [notes, dateField])

  // 生成日历网格数据
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // 当月第一天
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()

    // 当月最后一天
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // 上月需要显示的天数
    const prevMonthDays = firstDayOfWeek
    const prevMonth = new Date(year, month, 0)
    const prevMonthLastDay = prevMonth.getDate()

    // 下月需要显示的天数
    const totalCells = 42 // 6周 x 7天
    const nextMonthDays = totalCells - prevMonthDays - daysInMonth

    const days: Array<{
      date: Date
      isCurrentMonth: boolean
      isToday: boolean
      noteCount: number
      notes: Note[]
    }> = []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 上月
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      const dateKey = formatDateKey(date)
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        noteCount: distribution.get(dateKey) || 0,
        notes: notesByDate.get(dateKey) || [],
      })
    }

    // 当月
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i)
      const dateKey = formatDateKey(date)
      days.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        noteCount: distribution.get(dateKey) || 0,
        notes: notesByDate.get(dateKey) || [],
      })
    }

    // 下月
    for (let i = 1; i <= nextMonthDays; i++) {
      const date = new Date(year, month + 1, i)
      const dateKey = formatDateKey(date)
      days.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        noteCount: distribution.get(dateKey) || 0,
        notes: notesByDate.get(dateKey) || [],
      })
    }

    return days
  }, [currentDate, distribution, notesByDate])

  // 获取选中日期的笔记
  const selectedDateNotes = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = formatDateKey(selectedDate)
    return notesByDate.get(dateKey) || []
  }, [selectedDate, notesByDate])

  return (
    <div className="flex h-full">
      {/* 日历网格 */}
      <div className="flex-1 p-6">
        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div
              key={day}
              className="text-center text-[13px] font-medium text-slate-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.005 }}
            >
              <CalendarCell
                date={day.date}
                isCurrentMonth={day.isCurrentMonth}
                isToday={day.isToday}
                isSelected={selectedDate ? isSameDay(day.date, selectedDate) : false}
                noteCount={day.noteCount}
                showHeatmap={showHeatmap}
                notes={day.notes}
                onClick={() => onSelectDate(day.date)}
              />
            </motion.div>
          ))}
        </div>

        {/* 热力图图例 */}
        {showHeatmap && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <span className="text-[11px] text-slate-400">少</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded bg-slate-100 dark:bg-white/[0.03]" />
              <div className="w-3 h-3 rounded bg-[#5E6AD2]/20" />
              <div className="w-3 h-3 rounded bg-[#5E6AD2]/40" />
              <div className="w-3 h-3 rounded bg-[#5E6AD2]/60" />
              <div className="w-3 h-3 rounded bg-[#5E6AD2]/80" />
            </div>
            <span className="text-[11px] text-slate-400">多</span>
          </div>
        )}
      </div>

      {/* 选中日期的笔记列表侧栏 */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="w-80 border-l border-black/[0.03] dark:border-white/[0.06] p-4 overflow-y-auto"
          >
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
              </h3>
              <p className="text-[12px] text-slate-400 mt-1">
                {selectedDateNotes.length} 篇笔记
              </p>
            </div>

            {selectedDateNotes.length > 0 ? (
              <div className="space-y-2">
                {selectedDateNotes.map((note, index) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <DraggableNote
                      note={note}
                      onClick={() => onSelectNote(note)}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-[13px] text-slate-400">暂无笔记</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
