import { Bell } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { tagColor } from '../../lib/tagColor'
import { formatChipTime } from '../../hooks/useCalendarPage'
import type { Note } from '../../lib/db'

// chip 两种身份：笔记（按创建/修改时间落格）、提醒（按提醒时间落格）
export type ChipKind = 'note' | 'reminder'

// 拖拽负载：dragEnd 里据 type 决定挪 createdAt 还是挪提醒日期
export interface ChipDragData {
  type: ChipKind
  note: Note
}

// 纯展示 chip：月格与拖拽 ghost 共用。笔记 chip 用第一个标签的哈希色，无标签用中性灰；
// 提醒 chip 统一琥珀色带铃铛与时刻
export function Chip({ note, kind, ghost }: { note: Note; kind: ChipKind; ghost?: boolean }) {
  const shell = `h-5 flex items-center gap-1 px-1.5 rounded-[5px] text-[11px] leading-none font-medium min-w-0 ${
    ghost ? 'shadow-lg ring-1 ring-black/10 dark:ring-white/10' : ''
  }`

  if (kind === 'reminder') {
    return (
      <div className={`${shell} bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400`}>
        <Bell className="h-2.5 w-2.5 shrink-0" strokeWidth={2.2} />
        {note.reminderDate && (
          <span className="shrink-0 tabular-nums">{formatChipTime(note.reminderDate)}</span>
        )}
        <span className="truncate">{note.title || '无标题'}</span>
      </div>
    )
  }

  const tag = note.tags?.[0]
  const c = tag ? tagColor(tag) : null
  return (
    <div
      className={`${shell} ${c ? '' : 'bg-black/[0.05] text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'}`}
      style={c ? { background: c.bg, color: c.base } : undefined}
    >
      <span className="truncate">{note.title || '无标题'}</span>
    </div>
  )
}

interface DraggableChipProps {
  note: Note
  kind: ChipKind
  // 修改时间轴上拖笔记 chip 无意义（拖拽只改 createdAt，界面上不会动），禁用
  disabled?: boolean
  onOpen: () => void
}

// 月格里的可拖拽 chip：单击打开笔记，拖 6px 后进入拖拽（不与单击冲突）
export function DraggableChip({ note, kind, disabled, onOpen }: DraggableChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${kind}-${note.id}`,
    data: { type: kind, note } satisfies ChipDragData,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`shrink-0 min-w-0 cursor-pointer ${isDragging ? 'opacity-30' : ''}`}
    >
      <Chip note={note} kind={kind} />
    </div>
  )
}
