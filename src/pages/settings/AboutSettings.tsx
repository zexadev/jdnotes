import { useUpdater } from '../../hooks/useUpdater'
import { ExternalLink, Github, Heart } from 'lucide-react'

export function AboutSettings() {
  const updater = useUpdater()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          关于 JD Notes
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          应用信息和开发者信息
        </p>
      </div>

      {/* 应用信息卡片 */}
      <div className="p-6 bg-gradient-to-br from-[#5E6AD2]/10 to-blue-500/10 dark:from-[#5E6AD2]/20 dark:to-blue-500/20 rounded-xl border border-[#5E6AD2]/20 dark:border-[#5E6AD2]/30">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-[#5E6AD2] rounded-xl flex items-center justify-center">
            <span className="text-2xl font-bold text-white">JD</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              JD Notes
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              v{updater.currentVersion || '0.1.0'}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          一个简洁高效的本地笔记应用，基于 SQLite 数据库，支持 AI 对话、Markdown 编辑、标签管理和提醒功能。
        </p>
      </div>

      {/* 技术栈 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          技术栈
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">前端框架</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">React + TypeScript</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">桌面框架</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Tauri</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">数据库</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">SQLite</div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">样式框架</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Tailwind CSS</div>
          </div>
        </div>
      </div>

      {/* 核心功能 */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          核心功能
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">✓</span>
            <span><strong>Markdown 编辑：</strong>支持富文本编辑和实时预览</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">✓</span>
            <span><strong>AI 对话：</strong>集成多个 AI 平台，支持智能对话</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">✓</span>
            <span><strong>标签管理：</strong>灵活的标签系统，便于分类整理</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">✓</span>
            <span><strong>提醒功能：</strong>设置笔记提醒，到期自动通知</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">✓</span>
            <span><strong>本地存储：</strong>所有数据存储在本地，保护隐私</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#5E6AD2] mt-1">✓</span>
            <span><strong>数据导出：</strong>支持 JSON 和 Markdown 格式导出</span>
          </li>
        </ul>
      </div>

      {/* 链接 */}
      <div className="space-y-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5 text-gray-400" />
            <span>GitHub 仓库</span>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400" />
        </a>
      </div>

      {/* 致谢 */}
      <div className="p-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          <h3 className="text-sm font-medium text-pink-800 dark:text-pink-300">
            致谢
          </h3>
        </div>
        <p className="text-xs text-pink-700 dark:text-pink-300 italic">
          to jiaxiang - 感谢你的支持与陪伴
        </p>
      </div>

      {/* 版权信息 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          © 2024 JD Notes. All rights reserved.
        </p>
      </div>
    </div>
  )
}
