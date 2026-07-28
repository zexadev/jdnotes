import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import {
  useCalendarPage,
  parseDateKey,
  type DateField,
} from '../../hooks/useCalendarPage'
import { formatDateKey, type Note } from '../../lib/db'
import { MonthGrid } from './MonthGrid'
import { DayPanel } from './DayPanel'
import { Chip, type ChipDragData } from './NoteChip'

interface CalendarViewProps {
  onSelectNote: (note: Note) => void
  // 在指定日期新建笔记（App 层负责建笔记、定 createdAt、切到编辑器）
  onCreateNote: (date: Date) => void
}

export function CalendarView({ onSelectNote, onCreateNote }: CalendarViewProps) {
  const cal = useCalendarPage()
  const [activeDrag, setActiveDrag] = useState<ChipDragData | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // 拖 6px 才进入拖拽，单击不受影响
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // 网格范围内的笔记按日分组（按当前时间轴）
  const notesByDay = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const note of cal.notes) {
      const key = formatDateKey(note[cal.dateField])
      const list = map.get(key)
      if (list) list.push(note)
      else map.set(key, [note])
    }
    return map
  }, [cal.notes, cal.dateField])

  // 提醒按提醒日期分组（提醒显示在它约定的那天，不是笔记创建那天）
  const remindersByDay = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const note of cal.reminderNotes) {
      if (!note.reminderDate) continue
      const key = formatDateKey(note.reminderDate)
      const list = map.get(key)
      if (list) list.push(note)
      else map.set(key, [note])
    }
    return map
  }, [cal.reminderNotes])

  const selectedKey = formatDateKey(cal.selectedDate)
  const selectedNotes = notesByDay.get(selectedKey) ?? []
  const selectedReminders = remindersByDay.get(selectedKey) ?? []

  // 当前月（非 6 周网格）内的笔记，导出用
  const monthNotes = useMemo(
    () =>
      cal.notes.filter((note) => {
        const d = note[cal.dateField]
        return (
          d.getFullYear() === cal.currentDate.getFullYear() &&
          d.getMonth() === cal.currentDate.getMonth()
        )
      }),
    [cal.notes, cal.dateField, cal.currentDate]
  )

  // 键盘导航：方向键移日、PgUp/PgDn 移月、T/Home 回今天、Enter 在选中日新建
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // target 可能是 window/document（非 Element 无 closest），防御
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('input, textarea, select, button, [contenteditable="true"], [role="button"]')) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          cal.moveSelection(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          cal.moveSelection(1)
          break
        case 'ArrowUp':
          e.preventDefault()
          cal.moveSelection(-7)
          break
        case 'ArrowDown':
          e.preventDefault()
          cal.moveSelection(7)
          break
        case 'PageUp':
          e.preventDefault()
          cal.selectMonthDelta(-1)
          break
        case 'PageDown':
          e.preventDefault()
          cal.selectMonthDelta(1)
          break
        case 'Home':
        case 't':
        case 'T':
          e.preventDefault()
          cal.goToToday()
          break
        case 'Enter':
          e.preventDefault()
          onCreateNote(cal.selectedDate)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cal, onCreateNote])

  // 导出菜单点击外部关闭
  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as globalThis.Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [exportOpen])

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDrag((e.active.data.current as ChipDragData) ?? null)
  }, [])

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const data = e.active.data.current as ChipDragData | undefined
      setActiveDrag(null)
      const dateKey = e.over?.data.current?.dateKey as string | undefined
      if (!data || !dateKey) return
      const target = parseDateKey(dateKey)
      if (data.type === 'reminder') {
        await cal.moveReminderToDate(data.note, target)
      } else {
        await cal.moveNoteToDate(data.note, target)
      }
    },
    [cal]
  )

  const handleExport = useCallback(
    async (format: 'markdown' | 'json') => {
      setExportOpen(false)
      const year = cal.currentDate.getFullYear()
      const month = cal.currentDate.getMonth() + 1
      const label = `${year}年${month}月`
      const stem = `notes-${year}-${String(month).padStart(2, '0')}`
      try {
        if (format === 'markdown') {
          const filePath = await save({
            filters: [{ name: 'Markdown', extensions: ['md'] }],
            defaultPath: `${stem}.md`,
          })
          if (filePath) {
            await writeFile(
              filePath,
              new TextEncoder().encode(generateMarkdown(monthNotes, label))
            )
          }
        } else {
          const filePath = await save({
            filters: [{ name: 'JSON', extensions: ['json'] }],
            defaultPath: `${stem}.json`,
          })
          if (filePath) {
            await writeFile(
              filePath,
              new TextEncoder().encode(JSON.stringify(monthNotes, null, 2))
            )
          }
        }
      } catch (error) {
        console.error('Export failed:', error)
      }
    },
    [cal.currentDate, monthNotes]
  )

  const year = cal.currentDate.getFullYear()
  const month = cal.currentDate.getMonth() + 1

  const iconBtn =
    'w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors'

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="h-full flex bg-[#F9FBFC] dark:bg-[#0B0D11]">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* 头部：年月 + 导航 | 时间轴 + 导出 */}
          <header className="h-14 shrink-0 px-5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <h2 className="mr-2 text-[17px] font-semibold tracking-tight tabular-nums text-slate-900 dark:text-slate-100">
                {year}年{month}月
              </h2>
              <button onClick={() => cal.moveMonth(-1)} className={iconBtn} title="上个月">
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button onClick={() => cal.moveMonth(1)} className={iconBtn} title="下个月">
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={cal.goToToday}
                className="ml-1 h-7 px-2.5 rounded-md text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                今天
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* 时间轴切换：笔记落在创建日还是最后修改日 */}
              <div className="flex items-center bg-black/[0.04] dark:bg-white/[0.06] rounded-lg p-0.5">
                {(
                  [
                    { field: 'createdAt', label: '创建', title: '按创建时间排布' },
                    { field: 'updatedAt', label: '修改', title: '按修改时间排布' },
                  ] as { field: DateField; label: string; title: string }[]
                ).map(({ field, label, title }) => (
                  <button
                    key={field}
                    onClick={() => cal.setDateField(field)}
                    title={title}
                    className={`h-6 px-2.5 rounded-[7px] text-[12px] font-medium transition-colors ${
                      cal.dateField === field
                        ? 'bg-white dark:bg-[#1A1E26] text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 导出本月 */}
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((o) => !o)}
                  className={iconBtn}
                  title="导出本月"
                >
                  <Download className="h-4 w-4" strokeWidth={1.5} />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-48 rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#171A21] shadow-lg p-1">
                    <div className="px-2.5 pt-1.5 pb-1 text-[11px] text-slate-400 dark:text-slate-500">
                      {year}年{month}月 · {monthNotes.length} 篇
                    </div>
                    <button
                      onClick={() => handleExport('markdown')}
                      disabled={monthNotes.length === 0}
                      className="w-full h-8 px-2.5 rounded-md text-left text-[13px] text-slate-700 dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      导出为 Markdown
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      disabled={monthNotes.length === 0}
                      className="w-full h-8 px-2.5 rounded-md text-left text-[13px] text-slate-700 dark:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      导出为 JSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <MonthGrid
            currentDate={cal.currentDate}
            gridStart={cal.range.start}
            selectedDate={cal.selectedDate}
            dateField={cal.dateField}
            notesByDay={notesByDay}
            remindersByDay={remindersByDay}
            onSelectDate={cal.selectDate}
            onSelectNote={onSelectNote}
            onCreateNote={onCreateNote}
          />
        </div>

        <DayPanel
          date={cal.selectedDate}
          notes={selectedNotes}
          reminders={selectedReminders}
          dateField={cal.dateField}
          onSelectNote={onSelectNote}
          onCreateNote={onCreateNote}
          onClearReminder={cal.clearReminder}
        />
      </div>

      {/* 拖拽 ghost：脱离格子裁剪，跟手 */}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="w-44">
            <Chip note={activeDrag.note} kind={activeDrag.type} ghost />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// 导出为 Markdown：按月份汇总
function generateMarkdown(notes: Note[], label: string): string {
  const lines: string[] = []
  lines.push(`# 笔记导出 · ${label}`)
  lines.push('')
  lines.push(`> 共 ${notes.length} 篇 · 导出于 ${new Date().toLocaleString('zh-CN')}`)
  lines.push('')

  notes.forEach((note) => {
    lines.push('---')
    lines.push('')
    lines.push(`## ${note.title || '无标题'}`)
    lines.push('')
    if (note.tags.length > 0) {
      lines.push(note.tags.map((t) => `\`${t}\``).join(' '))
      lines.push('')
    }
    lines.push(
      `创建 ${note.createdAt.toLocaleString('zh-CN')} · 更新 ${note.updatedAt.toLocaleString('zh-CN')}`
    )
    lines.push('')
    if (note.content) {
      lines.push(note.content)
      lines.push('')
    }
  })

  return lines.join('\n')
}
