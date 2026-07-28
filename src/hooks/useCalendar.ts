import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { noteOperations, formatDateKey, type Note } from '../lib/db'
import type { ReminderWithType } from './useReminders'

export type CalendarView = 'month' | 'week' | 'day'
export type DateField = 'createdAt' | 'updatedAt'

export interface UseCalendarReturn {
  currentDate: Date
  view: CalendarView
  dateField: DateField
  notes: Note[] | undefined
  distribution: Map<string, number>
  dateRange: { start: Date; end: Date }
  selectedDate: Date | null
  showHeatmap: boolean
  setView: (view: CalendarView) => void
  setDateField: (field: DateField) => void
  setSelectedDate: (date: Date | null) => void
  setShowHeatmap: (show: boolean) => void
  goToToday: () => void
  goToPrevious: () => void
  goToNext: () => void
  goToDate: (date: Date) => void
  // 拖拽相关
  moveNoteToDate: (noteId: number, targetDate: Date) => Promise<void>
  // 提醒相关
  setNoteReminder: (noteId: number, reminderDate: Date) => Promise<void>
  clearNoteReminder: (noteId: number) => Promise<void>
  upcomingReminders: ReminderWithType[]  // 包含类型标记的提醒列表
  // 刷新方法
  refreshNotes: () => Promise<void>
  refreshReminders: () => Promise<void>
}

export function useCalendar(): UseCalendarReturn {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarView>('month')
  const [dateField, setDateField] = useState<DateField>('createdAt')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderWithType[]>([])
  
  // 精确定时器引用
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  // 计算日期范围
  const dateRange = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    switch (view) {
      case 'month':
        // 获取当月第一天
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        // 获取当月最后一天
        end.setMonth(end.getMonth() + 1, 0)
        end.setHours(23, 59, 59, 999)
        // 扩展到显示的完整日历（包括上月末和下月初）
        const firstDayOfWeek = new Date(start).getDay()
        start.setDate(start.getDate() - firstDayOfWeek)
        const lastDayOfWeek = new Date(end).getDay()
        end.setDate(end.getDate() + (6 - lastDayOfWeek))
        break
      case 'week':
        const day = start.getDay()
        start.setDate(start.getDate() - day)
        start.setHours(0, 0, 0, 0)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        break
      case 'day':
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
    }

    return { start, end }
  }, [currentDate, view])

  // 刷新笔记数据
  const refreshNotes = useCallback(async () => {
    try {
      const data = await noteOperations.getByDateRange(
        dateRange.start,
        dateRange.end,
        dateField
      )
      setNotes(data)
    } catch (error) {
      console.error('Failed to load calendar notes:', error)
    }
  }, [dateRange.start, dateRange.end, dateField])

  // 刷新提醒数据：同时获取"提前10分钟"和"到时间"的提醒
  const refreshReminders = useCallback(async () => {
    try {
      // 获取提前 10 分钟的提醒（从现在开始的 0-10 分钟内到期的）
      const upcoming = await noteOperations.getUpcomingReminders(10, 0)
      // 获取已到期的提醒（过去 2 分钟内到期的，避免错过）
      const due = await noteOperations.getDueReminders(2)
      
      // 合并并标记类型
      const upcomingWithType: ReminderWithType[] = upcoming.map(note => ({
        ...note,
        reminderType: 'upcoming' as const
      }))
      
      const dueWithType: ReminderWithType[] = due.map(note => ({
        ...note,
        reminderType: 'due' as const
      }))
      
      // 合并去重（同一个笔记可能同时在两个列表中）
      const allReminders = [...dueWithType, ...upcomingWithType]
      const uniqueReminders = allReminders.filter((reminder, index, self) =>
        index === self.findIndex(r => r.id === reminder.id)
      )
      
      setUpcomingReminders(uniqueReminders)
    } catch (error) {
      console.error('Failed to load reminders:', error)
    }
  }, [])

  // 设置精确定时器：为每个提醒设置精确到时间点的触发器
  const setupPreciseTimers = useCallback(async () => {
    // 清除所有现有定时器
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current.clear()

    try {
      // 获取所有有提醒的笔记
      const notesWithReminders = await noteOperations.getNotesWithReminders()
      const now = Date.now()

      notesWithReminders.forEach((note) => {
        if (!note.reminderDate) return

        const reminderTime = new Date(note.reminderDate).getTime()
        
        // 提前 10 分钟提醒的时间点
        const upcomingTime = reminderTime - 10 * 60 * 1000
        
        // 设置"提前提醒"定时器（如果还没到提前提醒时间）
        if (upcomingTime > now) {
          const upcomingDelay = upcomingTime - now
          const upcomingTimer = setTimeout(() => {
            refreshReminders()
          }, upcomingDelay)
          timersRef.current.set(note.id * 2, upcomingTimer)  // 使用 id*2 作为 upcoming 的 key
        }
        
        // 设置"到时提醒"定时器（如果还没到提醒时间）
        if (reminderTime > now) {
          const dueDelay = reminderTime - now
          const dueTimer = setTimeout(() => {
            refreshReminders()
          }, dueDelay)
          timersRef.current.set(note.id * 2 + 1, dueTimer)  // 使用 id*2+1 作为 due 的 key
        }
      })
    } catch (error) {
      console.error('Failed to setup precise timers:', error)
    }
  }, [refreshReminders])

  // 依赖变化时刷新笔记
  useEffect(() => {
    refreshNotes()
  }, [refreshNotes])

  // 初始化：设置精确定时器 + 轮询作为保底
  useEffect(() => {
    refreshReminders()
    setupPreciseTimers()
    
    // 每 30 秒轮询一次作为保底机制（防止定时器失效或新增提醒）
    const interval = setInterval(() => {
      refreshReminders()
      setupPreciseTimers()
    }, 30000)
    
    return () => {
      clearInterval(interval)
      // 清除所有精确定时器
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [refreshReminders, setupPreciseTimers])

  // 计算日期分布
  const distribution = useMemo(() => {
    if (!notes) return new Map<string, number>()

    const map = new Map<string, number>()
    notes.forEach((note) => {
      const date = note[dateField] as Date
      const key = formatDateKey(date)
      map.set(key, (map.get(key) || 0) + 1)
    })

    return map
  }, [notes, dateField])

  // 导航方法
  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  const goToPrevious = useCallback(() => {
    const newDate = new Date(currentDate)
    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1)
        break
      case 'week':
        newDate.setDate(newDate.getDate() - 7)
        break
      case 'day':
        newDate.setDate(newDate.getDate() - 1)
        break
    }
    setCurrentDate(newDate)
  }, [currentDate, view])

  const goToNext = useCallback(() => {
    const newDate = new Date(currentDate)
    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1)
        break
      case 'week':
        newDate.setDate(newDate.getDate() + 7)
        break
      case 'day':
        newDate.setDate(newDate.getDate() + 1)
        break
    }
    setCurrentDate(newDate)
  }, [currentDate, view])

  const goToDate = useCallback((date: Date) => {
    setCurrentDate(date)
    setSelectedDate(date)
  }, [])

  // 拖拽：移动笔记到新日期
  const moveNoteToDate = useCallback(async (noteId: number, targetDate: Date) => {
    // 保持原有的时分秒，只更改日期部分
    const note = await noteOperations.get(noteId)
    if (!note) return

    const originalDate = note.createdAt
    const newDate = new Date(targetDate)
    newDate.setHours(
      originalDate.getHours(),
      originalDate.getMinutes(),
      originalDate.getSeconds(),
      originalDate.getMilliseconds()
    )

    await noteOperations.updateCreatedAt(noteId, newDate)
    // 更新后刷新笔记列表
    await refreshNotes()
  }, [refreshNotes])

  // 设置笔记提醒
  const setNoteReminder = useCallback(async (noteId: number, reminderDate: Date) => {
    await noteOperations.setReminder(noteId, reminderDate)
    // 更新后刷新提醒列表并重新设置精确定时器
    await refreshReminders()
    await setupPreciseTimers()
  }, [refreshReminders, setupPreciseTimers])

  // 清除笔记提醒
  const clearNoteReminder = useCallback(async (noteId: number) => {
    await noteOperations.clearReminder(noteId)
    // 更新后刷新提醒列表并重新设置精确定时器
    await refreshReminders()
    await setupPreciseTimers()
  }, [refreshReminders, setupPreciseTimers])

  return {
    currentDate,
    view,
    dateField,
    notes,
    distribution,
    dateRange,
    selectedDate,
    showHeatmap,
    setView,
    setDateField,
    setSelectedDate,
    setShowHeatmap,
    goToToday,
    goToPrevious,
    goToNext,
    goToDate,
    moveNoteToDate,
    setNoteReminder,
    clearNoteReminder,
    upcomingReminders,
    refreshNotes,
    refreshReminders,
  }
}

// 辅助函数：获取周数
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// 辅助函数：获取热力图颜色
export function getHeatmapColor(count: number, isDark: boolean = false): string {
  if (count === 0) {
    return isDark ? 'bg-white/[0.03]' : 'bg-slate-100'
  }
  if (count <= 2) {
    return 'bg-[#5E6AD2]/20'
  }
  if (count <= 5) {
    return 'bg-[#5E6AD2]/40'
  }
  if (count <= 10) {
    return 'bg-[#5E6AD2]/60'
  }
  return 'bg-[#5E6AD2]/80'
}

// 辅助函数：格式化时间显示
export function formatCalendarTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 辅助函数：判断是否是同一天
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}
