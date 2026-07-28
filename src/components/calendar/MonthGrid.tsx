import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useDroppable } from '@dnd-kit/core'
import { formatDateKey, type Note } from '../../lib/db'
import { isSameDay, type DateField } from '../../hooks/useCalendarPage'
import { DraggableChip, type ChipKind } from './NoteChip'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
// 每格最多显示的 chip 数，超出折叠为「还有 N 条」
const MAX_CHIPS = 3

interface MonthGridProps {
  currentDate: Date
  gridStart: Date
  selectedDate: Date
  dateField: DateField
  notesByDay: Map<string, Note[]>
  remindersByDay: Map<string, Note[]>
  onSelectDate: (date: Date) => void
  onSelectNote: (note: Note) => void
  onCreateNote: (date: Date) => void
}

export function MonthGrid({
  currentDate,
  gridStart,
  selectedDate,
  dateField,
  notesByDay,
  remindersByDay,
  onSelectDate,
  onSelectNote,
  onCreateNote,
}: MonthGridProps) {
  // 固定 6 周 42 格，跨月行数恒定
  const days = useMemo(() => {
    const arr: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [gridStart])

  const today = new Date()
  const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`

  return (
    <div className="flex-1 min-h-0 flex flex-col px-5 pb-5">
      {/* 星期标题（周一起始） */}
      <div className="grid grid-cols-7 shrink-0 pb-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pl-2.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {w}
          </div>
        ))}
      </div>

      {/* 网格：gap-px + 底色 = 发丝分隔线 */}
      <motion.div
        key={monthKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex-1 min-h-0 rounded-xl border border-[#E4EAF0] dark:border-[#262932] overflow-hidden"
      >
        <div className="grid grid-cols-7 grid-rows-6 h-full gap-px bg-[#E4EAF0] dark:bg-[#262932]">
          {days.map((date) => {
            const key = formatDateKey(date)
            return (
              <DayCell
                key={key}
                date={date}
                dateKey={key}
                inMonth={date.getMonth() === currentDate.getMonth()}
                isToday={isSameDay(date, today)}
                isSelected={isSameDay(date, selectedDate)}
                dateField={dateField}
                notes={notesByDay.get(key) ?? []}
                reminders={remindersByDay.get(key) ?? []}
                onSelectDate={onSelectDate}
                onSelectNote={onSelectNote}
                onCreateNote={onCreateNote}
              />
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

interface DayCellProps {
  date: Date
  dateKey: string
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  dateField: DateField
  notes: Note[]
  reminders: Note[]
  onSelectDate: (date: Date) => void
  onSelectNote: (note: Note) => void
  onCreateNote: (date: Date) => void
}

function DayCell({
  date,
  dateKey,
  inMonth,
  isToday,
  isSelected,
  dateField,
  notes,
  reminders,
  onSelectDate,
  onSelectNote,
  onCreateNote,
}: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateKey}`,
    data: { dateKey },
  })

  // 提醒排最前（前瞻信息优先），笔记按时间序随后
  const items: { note: Note; kind: ChipKind }[] = [
    ...reminders.map((note) => ({ note, kind: 'reminder' as const })),
    ...notes.map((note) => ({ note, kind: 'note' as const })),
  ]
  const visible = items.slice(0, MAX_CHIPS)
  const overflow = items.length - visible.length

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelectDate(date)}
      onDoubleClick={() => onCreateNote(date)}
      className={`flex flex-col min-h-0 px-1 pt-1 pb-0.5 select-none transition-colors ${
        inMonth ? 'bg-white dark:bg-[#101318]' : 'bg-[#F9FBFC] dark:bg-[#0B0D11]'
      } ${
        isOver
          ? 'bg-[#5E6AD2]/[0.06] dark:bg-[#5E6AD2]/[0.14]'
          : 'hover:bg-[#F3F6FA] dark:hover:bg-[#161A22]'
      }`}
      style={
        isSelected
          ? { boxShadow: 'inset 0 0 0 1.5px #5E6AD2' }
          : isOver
            ? { boxShadow: 'inset 0 0 0 1.5px rgba(94,106,210,.55)' }
            : undefined
      }
    >
      {/* 日期数字：今天 = 品牌色圆徽 */}
      <div className="h-6 shrink-0 flex items-center px-1">
        {isToday ? (
          <span className="w-5 h-5 rounded-full bg-[#5E6AD2] text-white text-[11px] font-semibold flex items-center justify-center">
            {date.getDate()}
          </span>
        ) : (
          <span
            className={`text-[12px] font-medium tabular-nums ${
              inMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'
            }`}
          >
            {date.getDate()}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-[3px]">
        {visible.map(({ note, kind }) => (
          <DraggableChip
            key={`${kind}-${note.id}`}
            note={note}
            kind={kind}
            disabled={kind === 'note' && dateField === 'updatedAt'}
            onOpen={() => onSelectNote(note)}
          />
        ))}
        {overflow > 0 && (
          // 点击冒泡到格子 = 选中该日，右侧面板看全部
          <div className="px-1.5 text-[10px] text-slate-400 dark:text-slate-500">
            还有 {overflow} 条
          </div>
        )}
      </div>
    </div>
  )
}
