import { useState, useEffect } from 'react'
import { Download, Upload, FolderOpen, HardDrive, Settings2, FileOutput, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { dbOperations } from '../../lib/db'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { ExportModal } from '../../components/modals/ExportModal'
import { motion, AnimatePresence } from 'framer-motion'
import { relaunch } from '@tauri-apps/plugin-process'

interface DataSettingsProps {
  onDataChange?: () => void
}

export function DataSettings({ onDataChange }: DataSettingsProps) {
  const [dbInfo, setDbInfo] = useState<{
    path: string
    exists: boolean
    size: number
    size_formatted: string
    is_custom: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [operationMessage, setOperationMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [newDbPath, setNewDbPath] = useState('')

  // 加载数据库信息
  useEffect(() => {
    loadDatabaseInfo()
  }, [])

  const loadDatabaseInfo = async () => {
    try {
      const info = await dbOperations.getInfo()
      setDbInfo(info)
    } catch (e) {
      console.warn('Failed to load database info:', e)
    }
  }

  // 显示操作消息
  const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
    setOperationMessage({ type, text })
    setTimeout(() => setOperationMessage(null), 5000)
  }

  // 导出全部数据
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
      const selectedDir = await openDialog({
        directory: true,
        multiple: false,
        title: '选择数据库存储位置'
      })

      if (selectedDir && typeof selectedDir === 'string') {
        const newPath = await dbOperations.changeLocation(selectedDir)
        setNewDbPath(newPath)
        setShowRestartModal(true)
        loadDatabaseInfo()
      }
    } catch (e) {
      console.error('Change location failed:', e)
      showMessage('error', '更改位置失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setIsLoading(false)
  }

  // 重启应用
  const handleRestart = async () => {
    try {
      await relaunch()
    } catch (e) {
      console.error('Restart failed:', e)
      showMessage('error', '重启失败，请手动重启应用')
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          数据管理
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          管理笔记数据的导入、导出和存储位置
        </p>
      </div>

      {/* 操作消息提示 */}
      {operationMessage && (
        <div className={`px-4 py-3 rounded-lg text-sm whitespace-pre-line flex items-start gap-3 ${
          operationMessage.type === 'success'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : operationMessage.type === 'warning'
            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {operationMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <span>{operationMessage.text}</span>
        </div>
      )}

      {/* 数据库信息 */}
      {dbInfo && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                SQLite 数据库
                {dbInfo.is_custom && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs">
                    自定义位置
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={handleOpenInExplorer}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="在文件管理器中打开"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">路径:</span>
              <span className="truncate font-mono text-xs" title={dbInfo.path}>{dbInfo.path}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">大小:</span>
              <span>{dbInfo.size_formatted}</span>
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="space-y-3">
        {/* 更改存储位置 */}
        <button
          onClick={handleChangeLocation}
          disabled={isLoading}
          className="w-full px-4 py-3 text-sm text-left text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200 dark:border-blue-800"
        >
          <Settings2 className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-medium">更改存储位置</div>
            <div className="text-xs text-blue-500 dark:text-blue-400/80 mt-0.5">选择新的数据库存储目录</div>
          </div>
        </button>

        {/* 选择性导出 */}
        <button
          onClick={() => setShowExportModal(true)}
          disabled={isLoading}
          className="w-full px-4 py-3 text-sm text-left text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 dark:border-gray-700"
        >
          <FileOutput className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div>
            <div className="font-medium">选择性导出笔记</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">导出部分笔记为 Markdown 或 JSON</div>
          </div>
        </button>

        {/* 导出全部数据 */}
        <button
          onClick={handleExport}
          disabled={isLoading}
          className="w-full px-4 py-3 text-sm text-left text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 dark:border-gray-700"
        >
          <Download className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div>
            <div className="font-medium">导出全部数据（JSON）</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">备份所有笔记和聊天消息</div>
          </div>
        </button>

        {/* 导入数据 */}
        <button
          onClick={handleImport}
          disabled={isLoading}
          className="w-full px-4 py-3 text-sm text-left text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 dark:border-gray-700"
        >
          <Upload className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div>
            <div className="font-medium">导入数据（JSON）</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">从备份文件恢复数据</div>
          </div>
        </button>
      </div>

      {/* 警告提示 */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <strong>注意：</strong>导入数据会将导入的内容添加到现有数据中，不会覆盖现有数据。建议定期备份重要数据。
        </p>
      </div>

      {/* 导出模态框 */}
      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      {/* 重启提示模态框 */}
      <AnimatePresence>
        {showRestartModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 遮罩层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowRestartModal(false)}
            />

            {/* 模态框 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl"
            >
              {/* 头部 */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5E6AD2]/10 dark:bg-[#5E6AD2]/20 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-[#5E6AD2]" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      需要重启应用
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      存储位置已更改
                    </p>
                  </div>
                </div>
              </div>

              {/* 内容 */}
              <div className="px-6 py-5 space-y-4">
                {/* 成功提示 */}
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-green-900 dark:text-green-100 font-medium mb-1">
                      存储位置已成功更改
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 break-all">
                      {newDbPath}
                    </p>
                  </div>
                </div>

                {/* 说明 */}
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  为了使更改生效，需要重启应用。请确保已保存所有工作内容。
                </p>
              </div>

              {/* 底部按钮 */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex gap-3">
                <button
                  onClick={() => setShowRestartModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  稍后重启
                </button>
                <button
                  onClick={handleRestart}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors shadow-sm"
                >
                  立即重启
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
