import { useState, useEffect, useCallback } from 'react'
import { Bell, Clock, X, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification'
import type { ReminderWithType } from '../../hooks/useCalendar'

// 格式化剩余时间
export function formatTimeRemaining(targetDate: Date): string {
  const now = Date.now()
  const target = new Date(targetDate).getTime()
  const diff = target - now

  if (diff <= 0) return '已到时间'

  const minutes = Math.ceil(diff / (1000 * 60))
  
  if (minutes < 1) return '不到 1 分钟'
  if (minutes === 1) return '1 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (hours < 24) {
    if (remainingMinutes === 0) return `${hours} 小时`
    return `${hours} 小时 ${remainingMinutes} 分钟`
  }
  
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  
  if (remainingHours === 0) return `${days} 天`
  return `${days} 天 ${remainingHours} 小时`
}

// 发送系统通知
async function sendSystemNotification(title: string, body: string): Promise<boolean> {
  try {
    let permission = await isPermissionGranted()
    if (!permission) {
      permission = (await requestPermission()) === 'granted'
    }
    
    if (permission) {
      await sendNotification({ title, body })
      return true
    }
  } catch (e) {
    console.warn('Failed to send notification:', e)
  }
  return false
}

interface ReminderNotificationProps {
  reminders: ReminderWithType[]
  onSelectNote: (note: ReminderWithType) => void
  onDismiss: (noteId: number) => void
}

export function ReminderNotification({
  reminders,
  onSelectNote,
  onDismiss,
}: ReminderNotificationProps) {
  const [visibleReminders, setVisibleReminders] = useState<ReminderWithType[]>([])
  // 记录已通知的笔记 ID 和类型，避免同一类型重复通知
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set())

  // 初始化时请求通知权限
  useEffect(() => {
    const initPermission = async () => {
      try {
        const granted = await isPermissionGranted()
        if (!granted) {
          await requestPermission()
        }
      } catch (e) {
        console.warn('Failed to initialize notification permission:', e)
      }
    }
    initPermission()
  }, [])

  // 检查新的提醒并显示通知
  useEffect(() => {
    // 用 id + type 组合作为唯一标识，避免同一笔记的同一类型重复通知
    const newReminders = reminders.filter((r) => !notifiedIds.has(`${r.id}-${r.reminderType}`))

    if (newReminders.length > 0) {
      // 更新已通知的 ID + 类型
      setNotifiedIds((prev) => {
        const next = new Set(prev)
        newReminders.forEach((r) => next.add(`${r.id}-${r.reminderType}`))
        return next
      })

      // 添加到可见提醒列表（去除已存在的同 ID 提醒，用新类型替换）
      setVisibleReminders((prev) => {
        const filtered = prev.filter(p => !newReminders.some(n => n.id === p.id))
        return [...filtered, ...newReminders]
      })

      // 发送系统通知
      newReminders.forEach((note) => {
        const title = note.title || '无标题笔记'
        let message: string
        if (note.reminderType === 'due') {
          message = `⏰ 时间到了：${title}`
        } else {
          const remaining = note.reminderDate ? formatTimeRemaining(note.reminderDate) : ''
          message = `⏳ 还有 ${remaining}：${title}`
        }
        sendSystemNotification('JDNotes提醒您', message)
      })
    }
  }, [reminders, notifiedIds])

  // 关闭提醒
  const handleDismiss = useCallback((noteId: number) => {
    setVisibleReminders((prev) => prev.filter((r) => r.id !== noteId))
    onDismiss(noteId)
  }, [onDismiss])

  // 关闭所有提醒
  const handleDismissAll = useCallback(() => {
    visibleReminders.forEach((r) => onDismiss(r.id))
    setVisibleReminders([])
  }, [visibleReminders, onDismiss])

  if (visibleReminders.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
      <div className="pointer-events-auto">
        {/* 批量关闭按钮 */}
        {visibleReminders.length > 1 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismissAll}
            className="text-[12px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 mb-1 ml-auto block"
          >
            关闭所有 ({visibleReminders.length})
          </motion.button>
        )}

        {/* 提醒列表 */}
        <AnimatePresence mode="popLayout">
          {visibleReminders.map((note) => (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-black/[0.06] dark:border-white/[0.06] p-4 mb-2"
            >
              <div className="flex items-start gap-3">
                {/* 图标 - 根据类型显示不同颜色 */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  note.reminderType === 'due'
                    ? 'bg-red-100 dark:bg-red-500/20'
                    : 'bg-amber-100 dark:bg-amber-500/20'
                }`}>
                  {note.reminderType === 'due' ? (
                    <Bell className="h-5 w-5 text-red-600 dark:text-red-400" strokeWidth={1.5} />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
                  )}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-medium tracking-wider ${
                      note.reminderType === 'due'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {note.reminderType === 'due'
                        ? '⏰ 时间到了'
                        : `⏳ 还有 ${note.reminderDate ? formatTimeRemaining(note.reminderDate) : ''}`}
                    </span>
                    <button
                      onClick={() => handleDismiss(note.id)}
                      className="p-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded"
                    >
                      <X className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                    </button>
                  </div>

                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {note.title || '无标题'}
                  </h4>

                  {note.reminderDate && (
                    <p className="text-[12px] text-slate-500 mt-1">
                      {new Date(note.reminderDate).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}

                  <button
                    onClick={() => {
                      onSelectNote(note)
                      handleDismiss(note.id)
                    }}
                    className="mt-2 text-[13px] text-[#5E6AD2] hover:text-[#5E6AD2]/80 font-medium flex items-center gap-1"
                  >
                    查看笔记
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
