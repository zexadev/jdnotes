import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { DraggableNote } from './CalendarCell'
import { isSameDay } from '../../hooks/useCalendar'
import { formatDateKey, type Note } from '../../lib/db'

interface WeekViewProps {
  currentDate: Date
  notes: Note[]
  dateField: 'createdAt' | 'updatedAt'
  onSelectNote: (note: Note) => void
}

export function WeekView({
  currentDate,
  notes,
  dateField,
  onSelectNote,
}: WeekViewProps) {
  // 生成一周的日期
  const weekDays = useMemo(() => {
    const days: Date[] = []
    const startOfWeek = new Date(currentDate)
    const dayOfWeek = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(date.getDate() + i)
      days.push(date)
    }

    return days
  }, [currentDate])

  // 按日期分组笔记
  const notesByDay = useMemo(() => {
    const map = new Map<string, Note[]>()

    notes.forEach((note) => {
      const date = note[dateField] as Date
      const dateKey = formatDateKey(date)
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(note)
    })

    return map
  }, [notes, dateField])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="grid grid-cols-7 gap-4 min-h-[600px]">
        {weekDays.map((date, index) => (
          <motion.div
            key={date.toISOString()}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className="h-full"
          >
            <WeekDayColumn
              date={date}
              notes={notesByDay.get(formatDateKey(date)) || []}
              isToday={isSameDay(date, today)}
              onSelectNote={onSelectNote}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

interface WeekDayColumnProps {
  date: Date
  notes: Note[]
  isToday: boolean
  onSelectNote: (note: Note) => void
}

function WeekDayColumn({
  date,
  notes,
  isToday,
  onSelectNote,
}: WeekDayColumnProps) {
  // 设置为可放置区域
  const { setNodeRef, isOver } = useDroppable({
    id: `week-date-${date.toISOString()}`,
    data: { date },
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border p-4 flex flex-col h-full min-h-[500px]
        ${isToday
          ? 'bg-[#5E6AD2]/5 border-[#5E6AD2]/30'
          : 'bg-white dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.06]'
        }
        ${isOver ? 'border-[#5E6AD2] border-dashed border-2 bg-[#5E6AD2]/10' : ''}
      `}
    >
      {/* 日期标题 */}
      <div className="mb-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="text-[11px] text-slate-400 mb-1">
          {['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]}
        </div>
        <div className={`text-lg font-semibold ${isToday ? 'text-[#5E6AD2]' : 'text-slate-900 dark:text-slate-100'}`}>
          {date.getDate()}
        </div>
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {notes.map((note, index) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
          >
            <DraggableNote
              note={note}
              onClick={() => onSelectNote(note)}
            />
          </motion.div>
        ))}

        {/* 空状态 */}
        {notes.length === 0 && (
          <div className="text-[13px] text-slate-400 text-center py-4">
            暂无笔记
          </div>
        )}
      </div>
    </div>
  )
}
