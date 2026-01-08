import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Bell, Database, Download, Upload, FolderOpen, HardDrive, Settings2, RefreshCw, CheckCircle, AlertCircle, Loader2, FileOutput, FileText } from 'lucide-react'
import { useSettings, PROVIDER_PRESETS, OPENAI_COMPATIBLE_PRESETS } from '../../hooks/useSettings'
import type { AIProvider } from '../../hooks/useSettings'
import { Select } from '../common/Select'
import type { SelectOption } from '../common/Select'
import { useUpdater } from '../../hooks/useUpdater'

// 平台选项定义
const PROVIDER_OPTIONS: SelectOption<AIProvider>[] = [
  { value: 'openai', label: 'OpenAI 兼容', description: '支持 OpenAI、DeepSeek、智谱、通义、Moonshot 等' },
  { value: 'anthropic', label: 'Anthropic Claude', description: 'Claude 官方 API' },
  { value: 'google', label: 'Google Gemini', description: 'Google AI Studio API' },
  { value: 'ollama', label: 'Ollama 本地', description: '本地运行的 Ollama 服务' },
]
import { dbOperations } from '../../lib/db'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { ExportModal } from './ExportModal'
import { ChangelogModal } from './ChangelogModal'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onDataChange?: () => void  // 数据变化时回调（导入数据后刷新页面）
}

export function SettingsModal({ open, onClose, onDataChange }: SettingsModalProps) {
  const { settings, updateSetting } = useSettings()
  const [showApiKey, setShowApiKey] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default'>('default')
  const [isCheckingPermission, setIsCheckingPermission] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showChangelogModal, setShowChangelogModal] = useState(false)
  
  // 软件更新
  const updater = useUpdater()
  
  // 数据库管理状态
  const [dbInfo, setDbInfo] = useState<{
    path: string
    exists: boolean
    size: number
    size_formatted: string
    is_custom: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [operationMessage, setOperationMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

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
    
    if (open) {
      checkPermission()
      loadDatabaseInfo()
    }
  }, [open])

  // 加载数据库信息
  const loadDatabaseInfo = async () => {
    try {
      const info = await dbOperations.getInfo()
      setDbInfo(info)
    } catch (e) {
      console.warn('Failed to load database info:', e)
    }
  }

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

  // 显示操作消息
  const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
    setOperationMessage({ type, text })
    setTimeout(() => setOperationMessage(null), 5000)
  }

  // 导出数据
  const handleExport = async () => {
    setIsLoading(true)
    try {
      const jsonData = await dbOperations.exportJSON()
      
      const filePath = await save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        defaultPath: `jdnotes-backup-${new Date().toISOString().split('T')[0]}.json`
      })
      
      if (filePath) {
        await writeTextFile(filePath, jsonData)
        showMessage('success', '数据导出成功！')
      }
    } catch (e) {
      console.error('Export failed:', e)
      showMessage('error', '导出失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setIsLoading(false)
  }

  // 导入数据
  const handleImport = async () => {
    setIsLoading(true)
    try {
      const filePath = await openDialog({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        multiple: false
      })
      
      if (filePath && typeof filePath === 'string') {
        const jsonData = await readTextFile(filePath)
        const result = await dbOperations.importJSON(jsonData)
        showMessage('success', `导入成功！共导入 ${result.notes} 条笔记，${result.messages} 条消息`)
        loadDatabaseInfo()
        // 通知父组件刷新数据
        onDataChange?.()
      }
    } catch (e) {
      console.error('Import failed:', e)
      showMessage('error', '导入失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setIsLoading(false)
  }

  // 更改数据库存储位置
  const handleChangeLocation = async () => {
    setIsLoading(true)
    try {
      console.log('Opening directory dialog...')
      // 让用户选择目录
      const selectedDir = await openDialog({
        directory: true,
        multiple: false,
        title: '选择数据库存储位置'
      })
      
      console.log('Selected directory:', selectedDir)
      
      if (selectedDir && typeof selectedDir === 'string') {
        console.log('Calling changeLocation with:', selectedDir)
        const newPath = await dbOperations.changeLocation(selectedDir)
        console.log('New path:', newPath)
        showMessage('success', `✅ 存储位置已更改为:\n${newPath}\n\n请重启应用以使更改生效！`)
        loadDatabaseInfo()
      } else {
        console.log('No directory selected or cancelled')
      }
    } catch (e) {
      console.error('Change location failed:', e)
      showMessage('error', '更改位置失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setIsLoading(false)
  }

  // 在文件管理器中打开数据库目录
  const handleOpenInExplorer = async () => {
    try {
      if (dbInfo?.path) {
        await revealItemInDir(dbInfo.path)
      }
    } catch (e) {
      console.error('Open in explorer failed:', e)
      showMessage('error', '打开失败: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 模态框 */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-dark-sidebar">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            设置
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 操作消息提示 */}
        {operationMessage && (
          <div className={`mx-6 mt-4 px-4 py-2 rounded-lg text-sm whitespace-pre-line ${
            operationMessage.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : operationMessage.type === 'warning'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            {operationMessage.text}
          </div>
        )}

        {/* 内容 */}
        <div className="px-6 py-4 space-y-6">
          {/* AI 配置区域 */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              AI 配置
            </h3>
            <div className="space-y-4">
              {/* 模型平台选择 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  模型平台
                </label>
                <Select
                  value={settings.aiProvider}
                  onChange={(provider) => {
                    const preset = PROVIDER_PRESETS[provider]
                    updateSetting('aiProvider', provider)
                    updateSetting('aiBaseUrl', preset.baseUrl)
                    updateSetting('aiModel', preset.defaultModel)
                  }}
                  options={PROVIDER_OPTIONS}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {PROVIDER_PRESETS[settings.aiProvider].description}
                </p>
              </div>

              {/* OpenAI 兼容服务快速选择 */}
              {settings.aiProvider === 'openai' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    快速选择服务
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {OPENAI_COMPATIBLE_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          updateSetting('aiBaseUrl', preset.baseUrl)
                          updateSetting('aiModel', preset.model)
                        }}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                          settings.aiBaseUrl === preset.baseUrl
                            ? 'bg-[#5E6AD2] text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* API 基础 URL */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  API 基础 URL
                </label>
                <input
                  type="text"
                  value={settings.aiBaseUrl}
                  onChange={(e) => updateSetting('aiBaseUrl', e.target.value)}
                  placeholder={PROVIDER_PRESETS[settings.aiProvider].baseUrl}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  API Key
                  {!PROVIDER_PRESETS[settings.aiProvider].apiKeyRequired && (
                    <span className="ml-1 text-gray-400">（可选）</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.aiApiKey}
                    onChange={(e) => updateSetting('aiApiKey', e.target.value)}
                    placeholder={PROVIDER_PRESETS[settings.aiProvider].apiKeyPlaceholder}
                    className="w-full px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 模型名称 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  模型名称
                </label>
                <input
                  type="text"
                  value={settings.aiModel}
                  onChange={(e) => updateSetting('aiModel', e.target.value)}
                  placeholder={PROVIDER_PRESETS[settings.aiProvider].defaultModel}
                  className="w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* 数据管理区域 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Database className="h-4 w-4" />
              数据管理
            </h3>
            
            {/* 数据库信息 */}
            {dbInfo && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      SQLite 数据库
                      {dbInfo.is_custom && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-[10px]">
                          自定义位置
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={handleOpenInExplorer}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="在文件管理器中打开"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate" title={dbInfo.path}>{dbInfo.path}</span>
                  </div>
                  <div>大小: {dbInfo.size_formatted}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {/* 更改存储位置 */}
              <button
                onClick={handleChangeLocation}
                disabled={isLoading}
                className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <Settings2 className="h-4 w-4" />
                更改存储位置
              </button>

              {/* 选择性导出 */}
              <button
                onClick={() => setShowExportModal(true)}
                disabled={isLoading}
                className="w-full px-4 py-2.5 text-sm text-left text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <FileOutput className="h-4 w-4" />
                选择性导出笔记
              </button>

              {/* 导出数据 */}
              <button
                onClick={handleExport}
                disabled={isLoading}
                className="w-full px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-gray-400" />
                导出全部数据（JSON）
              </button>

              {/* 导入数据 */}
              <button
                onClick={handleImport}
                disabled={isLoading}
                className="w-full px-4 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <Upload className="h-4 w-4 text-gray-400" />
                导入数据（JSON）
              </button>
            </div>
          </div>

          {/* 提醒通知设置 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              提醒通知
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Bell className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  系统通知
                </span>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                启用系统通知后，笔记提醒到期时会收到系统弹窗通知。
              </p>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  当前状态
                </span>
                {isCheckingPermission ? (
                  <span className="text-xs text-gray-400">检测中...</span>
                ) : notificationPermission === 'granted' ? (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    已启用
                  </span>
                ) : notificationPermission === 'denied' ? (
                  <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    已拒绝
                  </span>
                ) : (
                  <button
                    onClick={handleRequestPermission}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors"
                  >
                    启用通知
                  </button>
                )}
              </div>
              
              {notificationPermission === 'denied' && (
                <p className="mt-3 text-xs text-gray-400">
                  通知已被拒绝，请在系统设置中允许本应用发送通知。
                </p>
              )}
              
              {notificationPermission === 'granted' && (
                <p className="mt-3 text-xs text-gray-400">
                  提醒到期时，将显示系统弹窗通知和应用内通知。
                </p>
              )}
            </div>
          </div>

          {/* 软件更新 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              软件更新
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              {/* 当前版本 */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  当前版本
                </span>
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  v{updater.currentVersion || '0.1.0'}
                </span>
              </div>

              {/* 更新状态显示 */}
              {updater.status === 'idle' && (
                <button
                  onClick={updater.checkForUpdates}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  检查更新
                </button>
              )}

              {updater.status === 'checking' && (
                <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在检查更新...
                </div>
              )}

              {updater.status === 'not-available' && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    已是最新版本
                  </div>
                  <button
                    onClick={updater.checkForUpdates}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    再次检查
                  </button>
                </div>
              )}

              {updater.status === 'available' && updater.updateInfo && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      新版本
                    </span>
                    <span className="text-xs font-mono text-green-600 dark:text-green-400">
                      v{updater.updateInfo.version}
                    </span>
                  </div>
                  {updater.updateInfo.body && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 p-2 rounded max-h-24 overflow-y-auto">
                      {updater.updateInfo.body}
                    </div>
                  )}
                  <button
                    onClick={updater.downloadAndInstall}
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    下载并安装
                  </button>
                </div>
              )}

              {updater.status === 'downloading' && updater.progress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>下载中...</span>
                    <span>{updater.progress.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-[#5E6AD2] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${updater.progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    {(updater.progress.downloaded / 1024 / 1024).toFixed(1)} MB / {(updater.progress.total / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              )}

              {updater.status === 'ready' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    下载完成
                  </div>
                  <button
                    onClick={updater.installUpdate}
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    立即安装并重启
                  </button>
                </div>
              )}

              {updater.status === 'error' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    {updater.error || '更新失败'}
                  </div>
                  <button
                    onClick={updater.checkForUpdates}
                    className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    重试
                  </button>
                </div>
              )}

              {/* 查看更新日志按钮 */}
              <button
                onClick={() => setShowChangelogModal(true)}
                className="w-full mt-3 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                查看更新日志
              </button>
            </div>
          </div>

          {/* 关于区域 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              关于
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              JD Notes v{updater.currentVersion || '0.1.0'} (SQLite)
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              一个简洁高效的本地笔记应用
            </p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-3 italic">
              to jiaxiang
            </p>
          </div>
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 sticky bottom-0 bg-white dark:bg-dark-sidebar">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            完成
          </button>
        </div>
      </div>

      {/* 导出选择模态框 */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      {/* 更新日志模态框 */}
      <ChangelogModal
        open={showChangelogModal}
        onClose={() => setShowChangelogModal(false)}
      />
    </div>
  )
}
