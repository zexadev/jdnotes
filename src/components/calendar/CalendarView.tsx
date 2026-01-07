import { useCallback, useRef, useMemo } from 'react'
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useCalendar } from '../../hooks/useCalendar'
import { CalendarHeader } from './CalendarHeader'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { DayView } from './DayView'
import { ReminderNotification } from './ReminderNotification'
import type { Note } from '../../lib/db'

interface CalendarViewProps {
  onSelectNote: (note: Note) => void
  onBack?: () => void
}

export function CalendarView({ onSelectNote }: CalendarViewProps) {
  const calendar = useCalendar()
  const calendarRef = useRef<HTMLDivElement>(null)

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖拽 8px 后才激活
      },
    })
  )

  // 处理拖拽结束
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over) return

      // 从 active.id 提取笔记 ID
      const noteIdStr = String(active.id).replace('note-', '')
      const noteId = parseInt(noteIdStr, 10)

      if (isNaN(noteId)) return

      // 从 over.data 获取目标日期
      const targetDate = over.data.current?.date as Date | undefined

      if (targetDate) {
        await calendar.moveNoteToDate(noteId, targetDate)
      }
    },
    [calendar]
  )

  // 计算当前视图的时间范围
  const timeRange = useMemo(() => {
    const { view, currentDate } = calendar
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    if (view === 'month') {
      // 月视图：当月第一天到最后一天
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(end.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
    } else if (view === 'week') {
      // 周视图：本周一到周日
      const day = start.getDay()
      const diff = day === 0 ? -6 : 1 - day
      start.setDate(start.getDate() + diff)
      start.setHours(0, 0, 0, 0)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else {
      // 日视图：当天
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    }

    return { start, end }
  }, [calendar.view, calendar.currentDate])

  // 获取当前时间范围内的笔记
  const notesInRange = useMemo(() => {
    if (!calendar.notes) return []
    
    return calendar.notes.filter((note) => {
      const noteDate = new Date(
        calendar.dateField === 'createdAt' ? note.createdAt : note.updatedAt
      )
      return noteDate >= timeRange.start && noteDate <= timeRange.end
    })
  }, [calendar.notes, calendar.dateField, timeRange])

  // 获取时间范围描述
  const getTimeRangeLabel = useCallback(() => {
    const { view, currentDate } = calendar
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1

    if (view === 'month') {
      return `${year}年${month}月`
    } else if (view === 'week') {
      const startStr = `${timeRange.start.getMonth() + 1}月${timeRange.start.getDate()}日`
      const endStr = `${timeRange.end.getMonth() + 1}月${timeRange.end.getDate()}日`
      return `${startStr} - ${endStr}`
    } else {
      return `${year}年${month}月${currentDate.getDate()}日`
    }
  }, [calendar.view, calendar.currentDate, timeRange])

  // 导出当前时间范围的笔记
  const handleExport = useCallback(async () => {
    if (notesInRange.length === 0) {
      alert('当前时间范围内没有笔记可导出')
      return
    }

    try {
      // 显示导出格式选择对话框
      const format = await showExportDialog(getTimeRangeLabel(), notesInRange.length)
      if (!format) return

      const dateStr = formatExportDate(calendar.currentDate)
      const viewName = calendar.view === 'month' ? 'month' : calendar.view === 'week' ? 'week' : 'day'

      if (format === 'markdown') {
        // 导出为 Markdown
        const content = generateMarkdownContent(notesInRange, getTimeRangeLabel())
        const filePath = await save({
          filters: [{ name: 'Markdown', extensions: ['md'] }],
          defaultPath: `notes-${viewName}-${dateStr}.md`
        })

        if (filePath) {
          const encoder = new TextEncoder()
          await writeFile(filePath, encoder.encode(content))
        }
      } else if (format === 'json') {
        // 导出为 JSON
        const content = JSON.stringify(notesInRange, null, 2)
        const filePath = await save({
          filters: [{ name: 'JSON', extensions: ['json'] }],
          defaultPath: `notes-${viewName}-${dateStr}.json`
        })

        if (filePath) {
          const encoder = new TextEncoder()
          await writeFile(filePath, encoder.encode(content))
        }
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('导出失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [calendar.currentDate, calendar.view, notesInRange, getTimeRangeLabel])

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col bg-[#F9FBFC] dark:bg-[#0B0D11]">
        {/* 提醒通知 */}
        <ReminderNotification
          reminders={calendar.upcomingReminders || []}
          onSelectNote={onSelectNote}
          onDismiss={calendar.clearNoteReminder}
        />

        <CalendarHeader
          currentDate={calendar.currentDate}
          view={calendar.view}
          dateField={calendar.dateField}
          showHeatmap={calendar.showHeatmap}
          onViewChange={calendar.setView}
          onDateFieldChange={calendar.setDateField}
          onHeatmapToggle={calendar.setShowHeatmap}
          onPrevious={calendar.goToPrevious}
          onNext={calendar.goToNext}
          onToday={calendar.goToToday}
          onExport={handleExport}
        />

        <div ref={calendarRef} className="flex-1 overflow-hidden" id="calendar-content">
          {calendar.view === 'month' && (
            <MonthView
              currentDate={calendar.currentDate}
              notes={calendar.notes || []}
              distribution={calendar.distribution}
              selectedDate={calendar.selectedDate}
              showHeatmap={calendar.showHeatmap}
              dateField={calendar.dateField}
              onSelectDate={calendar.goToDate}
              onSelectNote={onSelectNote}
            />
          )}

          {calendar.view === 'week' && (
            <WeekView
              currentDate={calendar.currentDate}
              notes={calendar.notes || []}
              dateField={calendar.dateField}
              onSelectNote={onSelectNote}
            />
          )}

          {calendar.view === 'day' && (
            <DayView
              currentDate={calendar.currentDate}
              notes={calendar.notes || []}
              dateField={calendar.dateField}
              onSelectNote={onSelectNote}
              onSetReminder={calendar.setNoteReminder}
              onClearReminder={calendar.clearNoteReminder}
            />
          )}
        </div>
      </div>
    </DndContext>
  )
}

// 导出日期格式化
function formatExportDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// 生成 Markdown 内容
function generateMarkdownContent(notes: Note[], timeRangeLabel: string): string {
  const lines: string[] = []
  
  lines.push(`# 笔记导出 - ${timeRangeLabel}`)
  lines.push('')
  lines.push(`> 导出时间: ${new Date().toLocaleString('zh-CN')}`)
  lines.push(`> 共 ${notes.length} 篇笔记`)
  lines.push('')
  lines.push('---')
  lines.push('')

  notes.forEach((note, index) => {
    lines.push(`## ${index + 1}. ${note.title || '无标题'}`)
    lines.push('')
    
    // 元信息
    const tags = note.tags || []
    if (tags.length > 0) {
      lines.push(`**标签**: ${tags.map((t: string) => `\`${t}\``).join(' ')}`)
      lines.push('')
    }
    
    lines.push(`**创建时间**: ${new Date(note.createdAt).toLocaleString('zh-CN')}`)
    lines.push(`**更新时间**: ${new Date(note.updatedAt).toLocaleString('zh-CN')}`)
    lines.push('')
    
    // 内容
    if (note.content) {
      lines.push('### 内容')
      lines.push('')
      lines.push(note.content)
      lines.push('')
    }
    
    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

// 显示导出格式选择对话框
function showExportDialog(timeRangeLabel: string, noteCount: number): Promise<'markdown' | 'json' | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('div')
    dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'
    dialog.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl w-96">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">导出笔记</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
          ${timeRangeLabel} · 共 ${noteCount} 篇笔记
        </p>
        <div class="space-y-2">
          <button id="export-markdown" class="w-full py-3 px-4 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors flex items-center gap-3">
            <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div class="font-medium">Markdown 文件</div>
              <div class="text-xs text-slate-400">适合阅读和分享</div>
            </div>
          </button>
          <button id="export-json" class="w-full py-3 px-4 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors flex items-center gap-3">
            <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <div>
              <div class="font-medium">JSON 文件</div>
              <div class="text-xs text-slate-400">适合备份和导入</div>
            </div>
          </button>
        </div>
        <button id="export-cancel" class="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          取消
        </button>
      </div>
    `

    const cleanup = () => {
      document.body.removeChild(dialog)
    }

    dialog.querySelector('#export-markdown')?.addEventListener('click', () => {
      cleanup()
      resolve('markdown')
    })

    dialog.querySelector('#export-json')?.addEventListener('click', () => {
      cleanup()
      resolve('json')
    })

    dialog.querySelector('#export-cancel')?.addEventListener('click', () => {
      cleanup()
      resolve(null)
    })

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        cleanup()
        resolve(null)
      }
    })

    document.body.appendChild(dialog)
  })
}
