import { useEffect, useState } from 'react'
import { X, FileText, Calendar, Tag, ExternalLink, Loader2 } from 'lucide-react'
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
    version: '1.6.0',
    date: '2026-03-25',
    notes: `## ✨ 新增功能
### 📊 表格功能
- 支持插入表格、调整列宽、表头行
- 光标在表格内时显示增删行列的气泡菜单
### 🌐 AI 联网能力
- AI 助手可搜索互联网获取最新信息
- 可读取指定网页内容
- 支持 IP 地理定位
### 🔗 Responses API
- 新增 OpenAI Responses API provider
- 支持 Azure AI Foundry、GPT-5 等
## 💅 优化
- 移除查看/编辑模式切换，笔记打开即可编辑
- AI system prompt 注入当前时间
- 表格操作重构为气泡菜单
- MCP 写入笔记后前端实时刷新
## 🐛 修复
- 修复重试和编辑消息时旧对话仍发给模型的问题
- 修复搜索结果为空的问题`
  },
  {
    version: '1.5.0',
    date: '2026-03-24',
    notes: `## ✨ 新增功能
### 🧠 AI Tools 函数调用
- AI 助手可通过工具按需读取、搜索、创建、修改和删除笔记
- 不再把笔记内容塞进提示词，上下文更高效
- 支持 OpenAI / Anthropic / Google / Ollama 四种 provider 的 tool calling
### 💬 多对话历史
- 每个笔记支持多个独立对话
- 可新建、切换、删除对话
### 🖼️ 图片发送
- 聊天中可附加图片发送给 AI（多模态支持）
### 🔗 MCP 自动注册扩展
- 启动时自动注册到 9 个 AI 工具（Claude Code/Desktop、Cursor、Windsurf、Gemini CLI、Kiro、Copilot CLI、OpenCode、Cline）
## 💅 优化
- AI 消息用 parts 结构渲染，tool calls 穿插在文字流中
- 用户消息改为右对齐气泡样式
- 模型选择器移至输入框上方`
  },
  {
    version: '1.4.1',
    date: '2026-03-23',
    notes: `## 🐛 修复
- 修复侧栏标签过多时设置按钮被挤出视图的问题
- 添加单实例限制，防止重复打开应用
## 💅 优化
- 统一品牌标识
- 更新 README 文档`
  },
  {
    version: '1.4.0',
    date: '2026-03-23',
    notes: `## ✨ 新增功能
### 🔗 MCP Server 集成
- 内置 HTTP MCP Server，Claude Code 等 AI 编程工具可直接将内容保存到笔记
- 支持创建笔记、追加内容、修改笔记三个工具
- 启动时自动注册到 Claude Code，无需手动配置
### ✅ 待办列表
- 支持创建待办事项，Markdown 兼容 \`- [ ]\` / \`- [x]\`
### 🛠️ 编辑器固定工具栏
- 文本格式、列表、引用、代码块、插入图片等常用操作
### 🖼️ 图片功能
- 支持工具栏插入、粘贴、拖拽插入
- 可缩放和预览大图
### 🔗 链接交互
- Ctrl+Click 打开链接（类似 VS Code）
### 🤖 AI 内联模式
- 重构 AI 内容插入为编辑器内联模式
### 🎨 界面优化
- 日夜动画主题切换开关
- 编辑器段落间距和待办列表对齐优化
## 🐛 问题修复
- 修复复制链接格式和自动标题 API 路径问题
- 修复 Ctrl+Click 无法打开链接的问题`
  },
  {
    version: '1.3.0',
    date: '2026-03-20',
    notes: `## ✨ 新增功能
### 🤖 AI 多来源配置
- 支持同时保存多个 AI 来源（如 DeepSeek + Claude + Gemini）
- 在聊天侧边栏直接切换模型/提供商，无需跳转设置页
- 设置页重新设计为来源列表 + 编辑面板
### ✏️ 编辑器交互优化
- 气泡菜单整合 AI 功能，移除右键菜单
- 新增 Ctrl+J 内联提问
### 🏗️ 基建
- 初始化 Nextra 文档站
- 添加 GitHub Actions 自动打包发布
- 清理 NSIS 自定义安装器相关配置`
  },
  {
    version: '1.2.0',
    date: '2026-01-10',
    notes: `## ✨ 新增功能
### 📊 数据仪表盘
- 新增仪表盘页面，提供笔记数据可视化分析
- 统计概览：笔记总数、今日新增、标签数量、平均字数
- 趋势分析：30天笔记创建趋势图表
- 分类分析：笔记分类饼图、标签云、标签使用排行
- 活动分析：24小时活动分布、每周热力图、时段分析
- 内容分析：字数分布统计、最近活动记录
- 使用响应式网格布局，支持深色模式
### ⚙️ 设置页面
- 新增独立设置页面，包含多个设置模块
- AI 设置：配置 AI 模型和 API
- 数据设置：数据备份与恢复
- 通知设置：提醒通知配置
- 更新设置：软件版本更新管理
- 关于设置：软件信息和开源许可
- Markdown 指南：Markdown 语法参考
### 🎨 界面优化
- 新增通用 Select 下拉选择组件
- 自定义窗口标题栏（Windows）
- 系统托盘功能，支持后台运行
- 优化动画效果和交互体验
### 🤖 AI 功能增强
- 扩展 AI 模型平台支持
- 从仅支持 OpenAI 扩展到支持多个主流 AI 平台
- 优化 AI 对话体验
### 🐛 问题修复
- 修复笔记中链接无法复制纯文本的问题
- 修复自动保存依赖数组问题
- 优化构建脚本`
  },
  {
    version: '1.1.0',
    date: '2026-01-08',
    notes: `## 📤 导出功能升级
- 新增笔记选择性导出
- 日历导出改为按时间范围导出（Markdown/JSON）
## 🐛 问题修复
- 修复笔记内容丢失问题
- 修复收藏操作时间戳问题
## 💅 界面优化
- "收件箱" 更名为 "全部笔记"
- 新增更新日志功能`
  },
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
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">$1</h2>')
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
  const changelog = CHANGELOG_DATA

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
            href="https://github.com/zexadev/jdnotes/releases"
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
