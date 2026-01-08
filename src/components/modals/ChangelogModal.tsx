import { useEffect, useState } from 'react'
import { X, FileText, Calendar, Tag, ExternalLink, RefreshCw, Loader2 } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'

interface ChangelogEntry {
  version: string
  date: string
  notes: string
}

interface ChangelogModalProps {
  open: boolean
  onClose: () => void
}

// 内置的更新日志数据
const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2026-01-07',
    notes: `## 🎉 首个正式版本

- 📝 富文本编辑器（Markdown、代码高亮、图片）
- 🤖 AI 智能助手（对话、续写、润色、翻译）
- 📅 日历视图（月/周/日）
- 🗂️ 笔记管理（搜索、收藏、标签、提醒）
- 📤 导出功能（PDF、Markdown）
- 🎨 深色/浅色主题
- 💾 本地 SQLite 存储`
  }
]

/**
 * 简单的 Markdown 转 HTML
 * 支持标题、列表、粗体、代码等基本语法
 */
function parseMarkdown(text: string): string {
  return text
    // 转义 HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 标题
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mt-5 mb-3">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-6 mb-4">$1</h2>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-600 dark:text-gray-400">$1</li>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800 dark:text-gray-200">$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 行内代码
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">$1</code>')
    // 换行
    .replace(/\n/g, '<br/>')
    // 包装列表
    .replace(/(<li[^>]*>.*?<\/li>(<br\/>)?)+/g, (match) => 
      `<ul class="space-y-1 my-2">${match.replace(/<br\/>/g, '')}</ul>`
    )
}

export function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [changelog, setChangelog] = useState<ChangelogEntry[]>(CHANGELOG_DATA)

  // 获取当前版本
  useEffect(() => {
    if (open) {
      setIsLoading(true)
      getVersion()
        .then(version => {
          setCurrentVersion(version)
          setIsLoading(false)
        })
        .catch(() => {
          setCurrentVersion('1.0.0')
          setIsLoading(false)
        })
    }
  }, [open])

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
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#5E6AD2]/10 rounded-lg">
              <FileText className="h-5 w-5 text-[#5E6AD2]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                更新日志
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                查看软件版本更新历史
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 当前版本信息 */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">当前版本</span>
            </div>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <span className="px-2 py-0.5 bg-[#5E6AD2]/10 text-[#5E6AD2] text-sm font-mono rounded">
                v{currentVersion}
              </span>
            )}
          </div>
        </div>

        {/* 更新日志内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {changelog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">暂无更新日志</p>
            </div>
          ) : (
            <div className="space-y-6">
              {changelog.map((entry, index) => (
                <div
                  key={entry.version}
                  className={`${index > 0 ? 'pt-6 border-t border-gray-200 dark:border-gray-800' : ''}`}
                >
                  {/* 版本头部 */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`px-2.5 py-1 rounded-lg text-sm font-semibold ${
                      index === 0
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>
                      v{entry.version}
                    </div>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                        最新
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                      <Calendar className="h-3.5 w-3.5" />
                      {entry.date}
                    </div>
                  </div>

                  {/* 更新内容 */}
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(entry.notes) }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 shrink-0 flex items-center justify-between">
          <a
            href="https://github.com/huancheng01/jdnotes/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#5E6AD2] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            查看 GitHub Releases
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChangelogModal
