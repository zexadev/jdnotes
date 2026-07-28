import { motion } from 'framer-motion'
import { Bell, Plus, X } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { tagColor } from '../../lib/tagColor'
import { isSameDay, isOverdue, formatChipTime, type DateField } from '../../hooks/useCalendarPage'
import { formatDateKey, type Note } from '../../lib/db'

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

// 摘要用：把 Markdown 语法剥成纯文本
function mdSnippet(md: string): string {
  return md
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/[*_~`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

interface DayPanelProps {
  date: Date
  notes: Note[]
  reminders: Note[]
  dateField: DateField
  onSelectNote: (note: Note) => void
  onCreateNote: (date: Date) => void
  onClearReminder: (noteId: number) => void
}

export function DayPanel({
  date,
  notes,
  reminders,
  dateField,
  onSelectNote,
  onCreateNote,
  onClearReminder,
}: DayPanelProps) {
  const isToday = isSameDay(date, new Date())
  const empty = notes.length === 0 && reminders.length === 0

  return (
    <aside className="w-[300px] shrink-0 h-full flex flex-col border-l border-[#E4EAF0] dark:border-[#262932]">
      {/* 抬头 */}
      <div className="px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
            {date.getMonth() + 1}月{date.getDate()}日
          </span>
          <span className="text-[12px] text-slate-400 dark:text-slate-500 truncate">
            {WEEKDAY_NAMES[date.getDay()]}
            {isToday ? ' · 今天' : ''}
          </span>
        </div>

        <button
          onClick={() => onCreateNote(date)}
          className="mt-3 w-full h-8 rounded-lg border border-dashed border-black/[0.12] dark:border-white/[0.14] text-[13px] text-slate-500 dark:text-slate-400 hover:text-[#5E6AD2] dark:hover:text-[#7C83E0] hover:border-[#5E6AD2]/45 hover:bg-[#5E6AD2]/[0.04] transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          {isToday ? '新建笔记' : '在这天新建笔记'}
        </button>
      </div>

      {empty ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[13px] text-slate-400 dark:text-slate-500">这一天没有笔记</span>
        </div>
      ) : (
        <motion.div
          key={formatDateKey(date)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex-1 min-h-0 overflow-y-auto px-4 pb-5 space-y-5"
        >
          {reminders.length > 0 && (
            <section>
              <SectionLabel text="提醒" />
              <div className="space-y-1.5">
                {reminders.map((note) => (
                  <ReminderRow
                    key={note.id}
                    note={note}
                    onOpen={() => onSelectNote(note)}
                    onClear={() => onClearReminder(note.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {notes.length > 0 && (
            <section>
              <SectionLabel text={`笔记 · ${notes.length}`} />
              <div className="space-y-2">
                {notes.map((note) => (
                  <PanelNoteCard
                    key={note.id}
                    note={note}
                    dateField={dateField}
                    onOpen={() => onSelectNote(note)}
                  />
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}
    </aside>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {text}
    </div>
  )
}

function ReminderRow({
  note,
  onOpen,
  onClear,
}: {
  note: Note
  onOpen: () => void
  onClear: () => void
}) {
  const overdue = !!note.reminderDate && isOverdue(note.reminderDate)

  return (
    <div
      className={`group flex items-center gap-2 h-9 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 ${
        overdue ? 'opacity-60' : ''
      }`}
    >
      <Bell className="h-3.5 w-3.5 text-amber-500 shrink-0" strokeWidth={1.8} />
      {note.reminderDate && (
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-amber-700 dark:text-amber-400">
          {formatChipTime(note.reminderDate)}
        </span>
      )}
      <button
        onClick={onOpen}
        className="flex-1 min-w-0 text-left text-[13px] text-slate-700 dark:text-slate-200 truncate hover:text-[#5E6AD2] dark:hover:text-[#7C83E0] transition-colors"
      >
        {note.title || '无标题'}
      </button>
      <button
        onClick={onClear}
        title="取消提醒"
        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
    </div>
  )
}

function PanelNoteCard({
  note,
  dateField,
  onOpen,
}: {
  note: Note
  dateField: DateField
  onOpen: () => void
}) {
  // 面板卡片同样可拖回网格挪日（仅创建时间轴；id 前缀与月格 chip 区分开）
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `panel-note-${note.id}`,
    data: { type: 'note', note },
    disabled: dateField === 'updatedAt',
  })

  const snippet = mdSnippet(note.content || '')

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={`p-3 rounded-lg border bg-white dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.07] hover:border-[#5E6AD2]/35 cursor-pointer transition-colors ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-[13px] font-medium text-slate-900 dark:text-slate-100 truncate">
          {note.title || '无标题'}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
          {formatChipTime(note[dateField])}
        </span>
      </div>
      {snippet && (
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
          {snippet}
        </p>
      )}
      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.slice(0, 3).map((tag) => {
            const c = tagColor(tag)
            return (
              <span
                key={tag}
                className="h-[18px] px-1.5 flex items-center rounded text-[10px] font-medium"
                style={{ background: c.bg, color: c.base }}
              >
                {tag}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
