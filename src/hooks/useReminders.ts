import { useState, useCallback, useEffect, useRef } from 'react'
import { noteOperations, type Note } from '../lib/db'

// 带类型标记的提醒
export interface ReminderWithType extends Note {
  reminderType: 'upcoming' | 'due'  // 'upcoming' = 提前提醒, 'due' = 到时提醒
}

export interface UseRemindersReturn {
  upcomingReminders: ReminderWithType[]
  refreshReminders: () => Promise<void>
}

// 全局提醒引擎：App 层唯一实例。查询即将到期/已到期的提醒，
// 为每条提醒设精确到时间点的定时器，30s 轮询保底（防定时器失效或外部新增提醒）。
export function useReminders(): UseRemindersReturn {
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderWithType[]>([])

  // 精确定时器引用
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

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

  return {
    upcomingReminders,
    refreshReminders,
  }
}
