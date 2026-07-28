import { useState, useMemo, useCallback, useEffect } from 'react'
import { noteOperations, formatDateKey, type Note } from '../lib/db'

export type DateField = 'createdAt' | 'updatedAt'

// 记住上次的时间轴选择（创建/修改），跨会话保持
const DATE_FIELD_STORAGE_KEY = 'calendar.dateField'

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// 周一为一周起始（返回零点）
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

// 月网格固定 6 周 42 格：跨月行数不变，格子高度稳定不跳
export function gridRange(monthAnchor: Date): { start: Date; end: Date } {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1)
  const start = startOfWeekMonday(first)
  const end = new Date(start)
  end.setDate(end.getDate() + 42)
  end.setMilliseconds(-1)
  return { start, end }
}

// "YYYY-MM-DD" → 本地零点 Date（不能用 new Date(key)：ISO 串会按 UTC 解析产生时区偏移）
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatChipTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export interface UseCalendarPageReturn {
  currentDate: Date
  selectedDate: Date
  dateField: DateField
  notes: Note[]
  reminderNotes: Note[]
  range: { start: Date; end: Date }
  setDateField: (field: DateField) => void
  selectDate: (date: Date) => void
  moveSelection: (days: number) => void
  selectMonthDelta: (delta: number) => void
  moveMonth: (delta: number) => void
  goToToday: () => void
  moveNoteToDate: (note: Note, target: Date) => Promise<void>
  moveReminderToDate: (note: Note, target: Date) => Promise<void>
  clearReminder: (noteId: number) => Promise<void>
  refresh: () => Promise<void>
}

// 日历页数据与导航。提醒的全局通知引擎在 useReminders（App 层），这里只管页面数据。
export function useCalendarPage(): UseCalendarPageReturn {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [dateField, setDateFieldState] = useState<DateField>(() =>
    localStorage.getItem(DATE_FIELD_STORAGE_KEY) === 'updatedAt' ? 'updatedAt' : 'createdAt'
  )
  const [notes, setNotes] = useState<Note[]>([])
  const [reminderNotes, setReminderNotes] = useState<Note[]>([])

  const range = useMemo(() => gridRange(currentDate), [currentDate])

  const refresh = useCallback(async () => {
    try {
      const [inRange, withReminders] = await Promise.all([
        noteOperations.getByDateRange(range.start, range.end, dateField),
        noteOperations.getNotesWithReminders(),
      ])
      setNotes(inRange)
      setReminderNotes(withReminders)
    } catch (error) {
      console.error('Failed to load calendar notes:', error)
    }
  }, [range, dateField])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setDateField = useCallback((field: DateField) => {
    setDateFieldState(field)
    localStorage.setItem(DATE_FIELD_STORAGE_KEY, field)
  }, [])

  // 选中某天；跨月时网格跟着翻过去
  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date)
    setCurrentDate((prev) =>
      prev.getFullYear() === date.getFullYear() && prev.getMonth() === date.getMonth()
        ? prev
        : date
    )
  }, [])

  const moveSelection = useCallback(
    (days: number) => {
      const next = new Date(selectedDate)
      next.setDate(next.getDate() + days)
      selectDate(next)
    },
    [selectedDate, selectDate]
  )

  // 键盘整月移动选中（日号越界钳到目标月末，如 1月31日 → 2月28日）
  const selectMonthDelta = useCallback(
    (delta: number) => {
      const y = selectedDate.getFullYear()
      const m = selectedDate.getMonth() + delta
      const lastDay = new Date(y, m + 1, 0).getDate()
      selectDate(new Date(y, m, Math.min(selectedDate.getDate(), lastDay)))
    },
    [selectedDate, selectDate]
  )

  // 头部箭头翻月：只翻网格，不动选中
  const moveMonth = useCallback((delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }, [])

  const goToToday = useCallback(() => {
    const today = new Date()
    setSelectedDate(today)
    setCurrentDate(today)
  }, [])

  // 拖拽挪日：保留原时分秒只换日期
  const moveNoteToDate = useCallback(
    async (note: Note, target: Date) => {
      if (isSameDay(note.createdAt, target)) return
      const next = new Date(target)
      next.setHours(
        note.createdAt.getHours(),
        note.createdAt.getMinutes(),
        note.createdAt.getSeconds(),
        note.createdAt.getMilliseconds()
      )
      await noteOperations.updateCreatedAt(note.id, next)
      await refresh()
    },
    [refresh]
  )

  // 拖拽提醒改期：保留提醒时刻只换日期
  const moveReminderToDate = useCallback(
    async (note: Note, target: Date) => {
      if (!note.reminderDate || isSameDay(note.reminderDate, target)) return
      const next = new Date(target)
      next.setHours(
        note.reminderDate.getHours(),
        note.reminderDate.getMinutes(),
        note.reminderDate.getSeconds(),
        0
      )
      await noteOperations.setReminder(note.id, next)
      await refresh()
    },
    [refresh]
  )

  const clearReminder = useCallback(
    async (noteId: number) => {
      await noteOperations.clearReminder(noteId)
      await refresh()
    },
    [refresh]
  )

  return {
    currentDate,
    selectedDate,
    dateField,
    notes,
    reminderNotes,
    range,
    setDateField,
    selectDate,
    moveSelection,
    selectMonthDelta,
    moveMonth,
    goToToday,
    moveNoteToDate,
    moveReminderToDate,
    clearReminder,
    refresh,
  }
}

// 保留提醒但已过期（仍 enabled）的判断：面板里降透明度用
export function isOverdue(reminderDate: Date): boolean {
  return reminderDate.getTime() < Date.now()
}

export { formatDateKey }
