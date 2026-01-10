import { useState } from 'react'
import { RefreshCw, Download, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react'
import { useUpdater } from '../../hooks/useUpdater'
import { ChangelogModal } from '../../components/modals/ChangelogModal'

export function UpdateSettings() {
  const updater = useUpdater()
  const [showChangelogModal, setShowChangelogModal] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          软件更新
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          检查并安装 JD Notes 的最新版本
        </p>
      </div>

      {/* 版本信息 */}
      <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            当前版本
          </span>
          <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
            v{updater.currentVersion || '0.1.0'}
          </span>
        </div>

        {/* 更新状态显示 */}
        {updater.status === 'idle' && (
          <button
            onClick={updater.checkForUpdates}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            检查更新
          </button>
        )}

        {updater.status === 'checking' && (
          <div className="flex items-center justify-center gap-3 py-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在检查更新...
          </div>
        )}

        {updater.status === 'not-available' && (
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              已是最新版本
            </div>
            <button
              onClick={updater.checkForUpdates}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              再次检查
            </button>
          </div>
        )}

        {updater.status === 'available' && updater.updateInfo && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                  发现新版本
                </span>
                <span className="text-sm font-mono font-medium text-green-600 dark:text-green-400">
                  v{updater.updateInfo.version}
                </span>
              </div>
              {updater.updateInfo.body && (
                <div className="text-xs text-green-700 dark:text-green-300 bg-white dark:bg-green-900/20 p-3 rounded max-h-32 overflow-y-auto">
                  {updater.updateInfo.body}
                </div>
              )}
            </div>
            <button
              onClick={updater.downloadAndInstall}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              下载并安装
            </button>
          </div>
        )}

        {updater.status === 'downloading' && updater.progress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>下载中...</span>
              <span className="font-mono font-medium">{updater.progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#5E6AD2] h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${updater.progress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {(updater.progress.downloaded / 1024 / 1024).toFixed(1)} MB / {(updater.progress.total / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        )}

        {updater.status === 'ready' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              下载完成，准备安装
            </div>
            <button
              onClick={updater.installUpdate}
              className="w-full px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              立即安装并重启
            </button>
          </div>
        )}

        {updater.status === 'error' && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{updater.error || '更新失败'}</span>
              </div>
            </div>
            <button
              onClick={updater.checkForUpdates}
              className="w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        )}
      </div>

      {/* 查看更新日志 */}
      <button
        onClick={() => setShowChangelogModal(true)}
        className="w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-3 border border-gray-200 dark:border-gray-700"
      >
        <FileText className="h-5 w-5 text-gray-400" />
        <div className="text-left">
          <div className="font-medium">查看更新日志</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">查看历史版本的更新记录</div>
        </div>
      </button>

      {/* 更新说明 */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
          自动更新说明
        </h3>
        <ul className="space-y-1.5 text-xs text-blue-700 dark:text-blue-300">
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>应用会在后台自动检查更新（每次启动时）</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>发现新版本时会提示下载，您可以选择立即更新或稍后更新</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>安装更新需要重启应用，请确保已保存所有工作</span>
          </li>
        </ul>
      </div>

      {/* 更新日志模态框 */}
      <ChangelogModal
        open={showChangelogModal}
        onClose={() => setShowChangelogModal(false)}
      />
    </div>
  )
}
