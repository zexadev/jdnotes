/**
 * 简易 Toast 通知系统
 * 提供全局的用户反馈通知功能
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastOptions {
  duration?: number // 显示时长，毫秒
}

export interface Toast {
  id: number
  message: string
  type: ToastType
  duration: number
}

// Toast 状态
let toasts: Toast[] = []
let toastId = 0
let listeners: Set<() => void> = new Set()

// 订阅 toast 变化
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// 通知监听器
function notify() {
  listeners.forEach(fn => fn())
}

// 显示 toast
function show(message: string, type: ToastType, options: ToastOptions = {}) {
  const { duration = 4000 } = options
  
  const toast: Toast = {
    id: ++toastId,
    message,
    type,
    duration,
  }
  
  toasts = [...toasts, toast]
  notify()
  
  // 自动移除
  setTimeout(() => {
    remove(toast.id)
  }, duration)
  
  return toast.id
}

// 移除 toast
function remove(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

// 导出 toast 方法
export const toast = {
  success: (message: string, options?: ToastOptions) => show(message, 'success', options),
  error: (message: string, options?: ToastOptions) => show(message, 'error', options),
  warning: (message: string, options?: ToastOptions) => show(message, 'warning', options),
  info: (message: string, options?: ToastOptions) => show(message, 'info', options),
  remove,
  subscribe,
  getToasts: () => toasts,
}

// 默认导出
export default toast
