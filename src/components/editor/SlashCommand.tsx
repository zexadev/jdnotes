import { isMobilePlatform } from '../../lib/platform'
import { useState, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Sparkles, FileText, Lightbulb, Code, MessageSquare, ListChecks,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus,
  Table, CodeSquare, Highlighter, AlignCenter,
  Info, AlertTriangle, AlertCircle, ChevronDown,
  Type, ImagePlus, Link2,
} from 'lucide-react'

export type SlashCommandGroup = 'basic' | 'format' | 'advanced' | 'ai'

export interface SlashCommandItem {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  group: SlashCommandGroup
  // 搜索别名（英文/拼音），让 /h1、/img、/biaoge 都能命中
  keywords?: string[]
  action: (editor: Editor) => void
}

interface SlashCommandProps {
  editor: Editor
  items: SlashCommandItem[]
  position: { top: number; left: number }
  // 过滤词 = 编辑器里 '/' 之后的真实文本（单一事实来源，IME/中文天然支持）
  query: string
  onSelect: (item: SlashCommandItem) => void
  onClose: () => void
}

const groupLabels: Record<SlashCommandGroup, string> = {
  basic: '基础块',
  format: '格式',
  advanced: '高级',
  ai: 'AI 命令',
}

export function SlashCommand({ items, position, query, onSelect, onClose }: SlashCommandProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // 过滤命令：标题/描述/别名
  const q = query.trim().toLowerCase()
  const filteredItems = q
    ? items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords?.some(k => k.includes(q))
      )
    : items

  // 过滤词变化时重置选中索引（渲染期调整，避免 effect 级联渲染）
  const [lastQuery, setLastQuery] = useState(query)
  if (lastQuery !== query) {
    setLastQuery(query)
    setSelectedIndex(0)
  }

  // 键盘导航：capture 阶段拦截，别让 ProseMirror 先吃掉 Enter/方向键
  // （之前在冒泡阶段监听，Enter 选命令的同时正文里也换了行）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // IME 组合期（Windows WebView2 报 key='Process'）不接管，避免误选
      if (e.isComposing || e.key === 'Process') return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev - 1 + Math.max(1, filteredItems.length)) % Math.max(1, filteredItems.length))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
      // 其余按键放行：字符进编辑器，过滤词由编辑器文本驱动
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [filteredItems, selectedIndex, onSelect, onClose])

  // 自动滚动到选中项
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 py-1 bg-white dark:bg-[#16181D] border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* 搜索提示 */}
      {q && (
        <div className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
          <span>搜索:</span>
          <span className="text-indigo-500 font-medium">{query.trim()}</span>
        </div>
      )}

      {/* 命令列表 */}
      <div className="max-h-[320px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-4 text-center text-[13px] text-gray-400 dark:text-gray-500">
            没有匹配的命令
          </div>
        ) : (
          (() => {
            let lastGroup = ''
            return filteredItems.map((item, index) => {
              const showGroupHeader = item.group !== lastGroup
              lastGroup = item.group
              return (
                <div key={item.id}>
                  {showGroupHeader && (
                    <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mt-1 first:mt-0">
                      {groupLabels[item.group]}
                    </div>
                  )}
                  <button
                    ref={index === selectedIndex ? selectedItemRef : null}
                    onClick={() => onSelect(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-indigo-50 dark:bg-indigo-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${
                      index === selectedIndex
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    }`}>
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium ${index === selectedIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {item.title}
                      </div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                        {item.description}
                      </div>
                    </div>
                  </button>
                </div>
              )
            })
          })()
        )}
      </div>

      <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span>{isMobilePlatform ? '点选插入' : '↑↓ 选择 · Enter 确认 · Esc 取消'}</span>
        <span>输入过滤</span>
      </div>
    </div>
  )
}

// 默认的斜杠命令项
// eslint-disable-next-line react-refresh/only-export-components
export function getDefaultSlashCommands(onAIAction: (action: string, prompt?: string) => void): SlashCommandItem[] {
  return [
    // === 基础块 ===
    {
      id: 'heading1',
      icon: <Heading1 className="h-4 w-4" />,
      title: '一级标题',
      description: '大标题',
      group: 'basic',
      keywords: ["h1","biaoti","yijibiaoti","head"],
      action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: 'heading2',
      icon: <Heading2 className="h-4 w-4" />,
      title: '二级标题',
      description: '中标题',
      group: 'basic',
      keywords: ["h2","erjibiaoti","head"],
      action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'heading3',
      icon: <Heading3 className="h-4 w-4" />,
      title: '三级标题',
      description: '小标题',
      group: 'basic',
      keywords: ["h3","sanjibiaoti","head"],
      action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: 'bullet-list',
      icon: <List className="h-4 w-4" />,
      title: '无序列表',
      description: '项目符号列表',
      group: 'basic',
      keywords: ["ul","list","wuxu","liebiao"],
      action: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      icon: <ListOrdered className="h-4 w-4" />,
      title: '有序列表',
      description: '数字编号列表',
      group: 'basic',
      keywords: ["ol","ordered","youxu","liebiao","shuzi"],
      action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'task-list',
      icon: <ListChecks className="h-4 w-4" />,
      title: '待办列表',
      description: '带复选框的待办清单',
      group: 'basic',
      keywords: ["todo","task","checkbox","daiban","qingdan"],
      action: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: 'blockquote',
      icon: <Quote className="h-4 w-4" />,
      title: '引用',
      description: '引用块',
      group: 'basic',
      keywords: ["quote","yinyong","yinwen"],
      action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },

    {
      id: 'paragraph',
      icon: <Type className="h-4 w-4" />,
      title: '正文',
      description: '普通段落文本',
      group: 'basic',
      keywords: ["p", "text", "paragraph", "zhengwen", "putong"],
      action: (editor) => editor.chain().focus().setParagraph().run(),
    },
    {
      id: 'note-ref',
      icon: <Link2 className="h-4 w-4" />,
      title: '笔记引用',
      description: '链接到另一篇笔记（双向链接）',
      group: 'basic',
      keywords: ["ref", "link", "wiki", "biji", "yinyong", "[["],
      action: (editor) => editor.chain().focus().insertContent('[[').run(),
    },

    // === 格式 ===
    {
      id: 'image',
      icon: <ImagePlus className="h-4 w-4" />,
      title: '图片',
      description: '从本地选择图片插入',
      group: 'format',
      keywords: ["img", "image", "tupian", "pic", "photo"],
      action: (editor) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.multiple = true
        input.onchange = async () => {
          const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith('image/'))
          if (files.length === 0) return
          const results = await Promise.allSettled(
            files.map(
              (file) =>
                new Promise<string>((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onload = () => resolve(reader.result as string)
                  reader.onerror = reject
                  reader.readAsDataURL(file)
                })
            )
          )
          const srcs = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value)
          if (srcs.length > 0) {
            editor.chain().focus().insertContent(srcs.map((src) => ({ type: 'image', attrs: { src } }))).run()
          }
        }
        input.click()
      },
    },
    {
      id: 'divider',
      icon: <Minus className="h-4 w-4" />,
      title: '分割线',
      description: '水平分隔线',
      group: 'format',
      keywords: ["hr","divider","fengexian","line"],
      action: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'code-block',
      icon: <CodeSquare className="h-4 w-4" />,
      title: '代码块',
      description: '语法高亮代码块',
      group: 'format',
      keywords: ["code","codeblock","daima","daimakuai"],
      action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'table',
      icon: <Table className="h-4 w-4" />,
      title: '表格',
      description: '插入 3x3 表格',
      group: 'format',
      keywords: ["table","biaoge"],
      action: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'highlight',
      icon: <Highlighter className="h-4 w-4" />,
      title: '高亮',
      description: '高亮选中文本',
      group: 'format',
      keywords: ["highlight","mark","gaoliang"],
      action: (editor) => editor.chain().focus().toggleHighlight().run(),
    },
    {
      id: 'align-center',
      icon: <AlignCenter className="h-4 w-4" />,
      title: '居中对齐',
      description: '文本居中',
      group: 'format',
      keywords: ["center","juzhong","align","duiqi"],
      action: (editor) => editor.chain().focus().setTextAlign('center').run(),
    },

    // === 高级 ===
    {
      id: 'callout-info',
      icon: <Info className="h-4 w-4" />,
      title: '信息提示',
      description: '蓝色信息提示框',
      group: 'advanced',
      keywords: ["info","callout","xinxi","tishi"],
      action: (editor) => editor.chain().focus().insertContent({
        type: 'callout',
        attrs: { type: 'info' },
        content: [{ type: 'paragraph' }],
      }).run(),
    },
    {
      id: 'callout-warning',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: '警告提示',
      description: '黄色警告提示框',
      group: 'advanced',
      keywords: ["warning","callout","jinggao"],
      action: (editor) => editor.chain().focus().insertContent({
        type: 'callout',
        attrs: { type: 'warning' },
        content: [{ type: 'paragraph' }],
      }).run(),
    },
    {
      id: 'callout-tip',
      icon: <Lightbulb className="h-4 w-4" />,
      title: '小贴士',
      description: '绿色提示框',
      group: 'advanced',
      keywords: ["tip","callout","tieshi","tips"],
      action: (editor) => editor.chain().focus().insertContent({
        type: 'callout',
        attrs: { type: 'tip' },
        content: [{ type: 'paragraph' }],
      }).run(),
    },
    {
      id: 'callout-error',
      icon: <AlertCircle className="h-4 w-4" />,
      title: '错误提示',
      description: '红色错误提示框',
      group: 'advanced',
      keywords: ["error","callout","cuowu","danger"],
      action: (editor) => editor.chain().focus().insertContent({
        type: 'callout',
        attrs: { type: 'error' },
        content: [{ type: 'paragraph' }],
      }).run(),
    },
    {
      id: 'details',
      icon: <ChevronDown className="h-4 w-4" />,
      title: '折叠区块',
      description: '可展开/折叠的内容',
      group: 'advanced',
      keywords: ["toggle","collapse","details","zhedie"],
      action: (editor) => {
        // Insert a simple toggle using blockquote as placeholder
        editor.chain().focus().insertContent({
          type: 'paragraph',
          content: [{ type: 'text', text: '▶ 点击展开...' }],
        }).run()
      },
    },

    // === AI 命令 ===
    {
      id: 'ai-continue',
      icon: <Sparkles className="h-4 w-4" />,
      title: 'AI 续写',
      description: '根据上文继续写作',
      group: 'ai',
      keywords: ["ai","continue","xuxie"],
      action: () => onAIAction('continue'),
    },
    {
      id: 'meeting-notes',
      icon: <FileText className="h-4 w-4" />,
      title: '会议纪要',
      description: '生成结构化会议模板',
      group: 'ai',
      keywords: ["meeting","huiyi","jiyao"],
      action: () => onAIAction('template', 'meeting'),
    },
    {
      id: 'brainstorm',
      icon: <Lightbulb className="h-4 w-4" />,
      title: '脑暴大纲',
      description: '生成5点思维大纲',
      group: 'ai',
      keywords: ["brainstorm","naobao","dagang","outline"],
      action: () => onAIAction('template', 'brainstorm'),
    },
    {
      id: 'code-impl',
      icon: <Code className="h-4 w-4" />,
      title: '代码实现',
      description: '根据描述生成代码',
      group: 'ai',
      keywords: ["ai","code","daima","shixian"],
      action: () => onAIAction('template', 'code'),
    },
    {
      id: 'custom-prompt',
      icon: <MessageSquare className="h-4 w-4" />,
      title: '自由提问',
      description: '输入自定义 AI 指令',
      group: 'ai',
      keywords: ["ai","ask","prompt","tiwen","ziyou"],
      action: () => onAIAction('show-inline-prompt'),
    },
  ]
}
