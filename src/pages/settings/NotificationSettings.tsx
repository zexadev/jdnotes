import { useState, useEffect } from 'react'
import { Bell, CheckCircle, XCircle } from 'lucide-react'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification'

export function NotificationSettings() {
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default'>('default')
  const [isCheckingPermission, setIsCheckingPermission] = useState(true)

  // 检查通知权限状态
  useEffect(() => {
    const checkPermission = async () => {
      setIsCheckingPermission(true)
      try {
        const granted = await isPermissionGranted()
        setNotificationPermission(granted ? 'granted' : 'default')
      } catch (e) {
        console.warn('Failed to check notification permission:', e)
        setNotificationPermission('default')
      }
      setIsCheckingPermission(false)
    }

    checkPermission()
  }, [])

  // 请求通知权限
  const handleRequestPermission = async () => {
    try {
      const result = await requestPermission()
      setNotificationPermission(result === 'granted' ? 'granted' : 'denied')

      // 如果授权成功，发送一个测试通知
      if (result === 'granted') {
        await sendNotification({
          title: 'JD Notes',
          body: '通知已启用！',
        })
      }
    } catch (e) {
      console.warn('Failed to request notification permission:', e)
      setNotificationPermission('denied')
    }
  }

  // 发送测试通知
  const handleTestNotification = async () => {
    try {
      await sendNotification({
        title: 'JD Notes',
        body: '每一个被记录的瞬间，都值得被温柔对待❤',
      })
    } catch (e) {
      console.error('Failed to send test notification:', e)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          通知设置
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          管理应用的系统通知和提醒功能
        </p>
      </div>

      {/* 通知权限状态 */}
      <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-6 w-6 text-gray-400" strokeWidth={1.5} />
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              系统通知
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              启用后，笔记提醒到期时会收到系统弹窗通知
            </p>
          </div>
        </div>

        {/* 权限状态显示 */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            当前状态
          </span>
          {isCheckingPermission ? (
            <span className="text-sm text-gray-400">检测中...</span>
          ) : notificationPermission === 'granted' ? (
            <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              已启用
            </span>
          ) : notificationPermission === 'denied' ? (
            <span className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              已拒绝
            </span>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              未设置
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="mt-4 space-y-2">
          {notificationPermission === 'default' && (
            <button
              onClick={handleRequestPermission}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors"
            >
              启用通知权限
            </button>
          )}

          {notificationPermission === 'granted' && (
            <button
              onClick={handleTestNotification}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
            >
              发送测试通知
            </button>
          )}
        </div>

        {/* 提示信息 */}
        {notificationPermission === 'denied' && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              通知权限已被拒绝。请前往系统设置中允许本应用发送通知。
            </p>
          </div>
        )}

        {notificationPermission === 'granted' && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300">
              提醒到期时，将同时显示系统弹窗通知和应用内通知。
            </p>
          </div>
        )}
      </div>

      {/* 功能说明 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          通知功能说明
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">•</span>
            <span>为笔记设置提醒时间后，到期时会自动发送通知</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">•</span>
            <span>系统通知会在桌面右下角（Windows）或右上角（macOS）弹出</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">•</span>
            <span>点击通知可快速打开对应的笔记</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">•</span>
            <span>应用内也会同时显示提醒弹窗，即使关闭系统通知也能看到</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
