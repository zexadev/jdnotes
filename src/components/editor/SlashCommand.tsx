import { useState, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Sparkles, FileText, Lightbulb, Code, MessageSquare, ListChecks,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus,
  Table, CodeSquare, Highlighter, AlignCenter,
  Info, AlertTriangle, AlertCircle, ChevronDown,
} from 'lucide-react'

export type SlashCommandGroup = 'basic' | 'format' | 'advanced' | 'ai'

export interface SlashCommandItem {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  group: SlashCommandGroup
  action: (editor: Editor) => void
}

interface SlashCommandProps {
  editor: Editor
  items: SlashCommandItem[]
  position: { top: number; left: number }
  onSelect: (item: SlashCommandItem) => void
  onClose: () => void
}

const groupLabels: Record<SlashCommandGroup, string> = {
  basic: '基础块',
  format: '格式',
  advanced: '高级',
  ai: 'AI 命令',
}

export function SlashCommand({ items, position, onSelect, onClose }: SlashCommandProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filterText, setFilterText] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // 过滤命令
  const filteredItems = filterText
    ? items.filter(item =>
        item.title.toLowerCase().includes(filterText.toLowerCase()) ||
        item.description.toLowerCase().includes(filterText.toLowerCase())
      )
    : items

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Backspace') {
        if (filterText.length > 0) {
          setFilterText(prev => prev.slice(0, -1))
        } else {
          onClose()
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setFilterText(prev => prev + e.key)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredItems, selectedIndex, onSelect, onClose, filterText])

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
      {filterText && (
        <div className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
          <span>搜索:</span>
          <span className="text-indigo-500 font-medium">{filterText}</span>
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
        <span>↑↓ 选择 · Enter 确认 · Esc 取消</span>
        <span>输入过滤</span>
      </div>
    </div>
  )
}

// 默认的斜杠命令项
export function getDefaultSlashCommands(onAIAction: (action: string, prompt?: string) => void): SlashCommandItem[] {
  return [
    // === 基础块 ===
    {
      id: 'heading1',
      icon: <Heading1 className="h-4 w-4" />,
      title: '一级标题',
      description: '大标题',
      group: 'basic',
      action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: 'heading2',
      icon: <Heading2 className="h-4 w-4" />,
      title: '二级标题',
      description: '中标题',
      group: 'basic',
      action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: 'heading3',
      icon: <Heading3 className="h-4 w-4" />,
      title: '三级标题',
      description: '小标题',
      group: 'basic',
      action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: 'bullet-list',
      icon: <List className="h-4 w-4" />,
      title: '无序列表',
      description: '项目符号列表',
      group: 'basic',
      action: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'ordered-list',
      icon: <ListOrdered className="h-4 w-4" />,
      title: '有序列表',
      description: '数字编号列表',
      group: 'basic',
      action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'task-list',
      icon: <ListChecks className="h-4 w-4" />,
      title: '待办列表',
      description: '带复选框的待办清单',
      group: 'basic',
      action: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: 'blockquote',
      icon: <Quote className="h-4 w-4" />,
      title: '引用',
      description: '引用块',
      group: 'basic',
      action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },

    // === 格式 ===
    {
      id: 'divider',
      icon: <Minus className="h-4 w-4" />,
      title: '分割线',
      description: '水平分隔线',
      group: 'format',
      action: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'code-block',
      icon: <CodeSquare className="h-4 w-4" />,
      title: '代码块',
      description: '语法高亮代码块',
      group: 'format',
      action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'table',
      icon: <Table className="h-4 w-4" />,
      title: '表格',
      description: '插入 3x3 表格',
      group: 'format',
      action: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'highlight',
      icon: <Highlighter className="h-4 w-4" />,
      title: '高亮',
      description: '高亮选中文本',
      group: 'format',
      action: (editor) => editor.chain().focus().toggleHighlight().run(),
    },
    {
      id: 'align-center',
      icon: <AlignCenter className="h-4 w-4" />,
      title: '居中对齐',
      description: '文本居中',
      group: 'format',
      action: (editor) => editor.chain().focus().setTextAlign('center').run(),
    },

    // === 高级 ===
    {
      id: 'callout-info',
      icon: <Info className="h-4 w-4" />,
      title: '信息提示',
      description: '蓝色信息提示框',
      group: 'advanced',
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
      action: () => onAIAction('continue'),
    },
    {
      id: 'meeting-notes',
      icon: <FileText className="h-4 w-4" />,
      title: '会议纪要',
      description: '生成结构化会议模板',
      group: 'ai',
      action: () => onAIAction('template', 'meeting'),
    },
    {
      id: 'brainstorm',
      icon: <Lightbulb className="h-4 w-4" />,
      title: '脑暴大纲',
      description: '生成5点思维大纲',
      group: 'ai',
      action: () => onAIAction('template', 'brainstorm'),
    },
    {
      id: 'code-impl',
      icon: <Code className="h-4 w-4" />,
      title: '代码实现',
      description: '根据描述生成代码',
      group: 'ai',
      action: () => onAIAction('template', 'code'),
    },
    {
      id: 'custom-prompt',
      icon: <MessageSquare className="h-4 w-4" />,
      title: '自由提问',
      description: '输入自定义 AI 指令',
      group: 'ai',
      action: () => onAIAction('show-inline-prompt'),
    },
  ]
}
