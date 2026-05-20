import { useEffect } from 'react'
import { Download, Sparkles, AlertCircle, CheckCircle, Loader2, X } from 'lucide-react'
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '../../hooks/useUpdater'

interface UpdateAvailableModalProps {
  open: boolean
  updateInfo: UpdateInfo | null
  status: UpdateStatus
  progress: UpdateProgress | null
  error: string | null
  onUpdate: () => void
  onInstall: () => void
  onLater: () => void
  onSkip: () => void
}

function parseMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-600 dark:text-gray-400">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800 dark:text-gray-200">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">$1</code>')
    .replace(/\n/g, '<br/>')
    .replace(/(<li[^>]*>.*?<\/li>(<br\/>)?)+/g, (match) =>
      `<ul class="space-y-1 my-2">${match.replace(/<br\/>/g, '')}</ul>`
    )
}

export function UpdateAvailableModal({
  open,
  updateInfo,
  status,
  progress,
  error,
  onUpdate,
  onInstall,
  onLater,
  onSkip,
}: UpdateAvailableModalProps) {
  const isBusy = status === 'downloading' || status === 'ready'

  // ESC 关闭（仅空闲时）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onLater()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onLater, isBusy])

  if (!open || !updateInfo) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isBusy && onLater()}
      />

      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                发现新版本
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-mono">v{updateInfo.currentVersion || '当前'}</span>
                <span className="mx-1.5">→</span>
                <span className="font-mono text-green-600 dark:text-green-400 font-medium">v{updateInfo.version}</span>
              </p>
            </div>
          </div>
          {!isBusy && (
            <button
              onClick={onLater}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* 更新说明 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {updateInfo.body ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(updateInfo.body) }}
            />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              此版本暂无更新说明。
            </p>
          )}

          {/* 下载进度 */}
          {status === 'downloading' && progress && (
            <div className="mt-5 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在下载...
                </span>
                <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                  {progress.percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-600 h-2 rounded-full transition-[width] duration-100 ease-linear"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              {progress.total > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center font-mono">
                  {(progress.downloaded / 1024 / 1024).toFixed(1)} MB / {(progress.total / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
            </div>
          )}

          {/* 下载完成 */}
          {status === 'ready' && (
            <div className="mt-5 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>下载完成，点击「立即重启」完成安装。</span>
            </div>
          )}

          {/* 错误 */}
          {status === 'error' && error && (
            <div className="mt-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">更新失败</div>
                <div className="text-xs mt-1 break-all">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 shrink-0 flex items-center justify-between gap-2">
          {status === 'ready' ? (
            <button
              onClick={onInstall}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              立即重启并安装
            </button>
          ) : (
            <>
              <button
                onClick={onSkip}
                disabled={isBusy}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                跳过此版本
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onLater}
                  disabled={isBusy}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  稍后提醒
                </button>
                <button
                  onClick={onUpdate}
                  disabled={isBusy}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === 'downloading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      下载中
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      立即更新
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdateAvailableModal
