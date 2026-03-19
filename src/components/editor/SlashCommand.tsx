import { useState, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { Sparkles, FileText, Lightbulb, Code, MessageSquare } from 'lucide-react'

export interface SlashCommandItem {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  action: (editor: Editor) => void
}

interface SlashCommandProps {
  editor: Editor
  items: SlashCommandItem[]
  position: { top: number; left: number }
  onSelect: (item: SlashCommandItem) => void
  onClose: () => void
}

export function SlashCommand({ items, position, onSelect, onClose }: SlashCommandProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % items.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onSelect(items[selectedIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [items, selectedIndex, onSelect, onClose])

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
      className="absolute z-50 w-64 py-1 bg-white dark:bg-[#16181D] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="px-2 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
        AI 命令
      </div>
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors ${
            index === selectedIndex
              ? 'bg-indigo-50 dark:bg-indigo-900/30'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <span className={`mt-0.5 ${index === selectedIndex ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {item.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium ${index === selectedIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {item.title}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {item.description}
            </div>
          </div>
        </button>
      ))}
      <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
        ↑↓ 选择 · Enter 确认 · Esc 取消
      </div>
    </div>
  )
}

// 默认的斜杠命令项
export function getDefaultSlashCommands(onAIAction: (action: string, prompt?: string) => void): SlashCommandItem[] {
  return [
    {
      id: 'ai-continue',
      icon: <Sparkles className="h-4 w-4" />,
      title: 'AI 续写',
      description: '根据上文继续写作',
      action: () => onAIAction('continue'),
    },
    {
      id: 'meeting-notes',
      icon: <FileText className="h-4 w-4" />,
      title: '会议纪要',
      description: '生成结构化会议模板',
      action: () => onAIAction('template', 'meeting'),
    },
    {
      id: 'brainstorm',
      icon: <Lightbulb className="h-4 w-4" />,
      title: '脑暴大纲',
      description: '生成5点思维大纲',
      action: () => onAIAction('template', 'brainstorm'),
    },
    {
      id: 'code-impl',
      icon: <Code className="h-4 w-4" />,
      title: '代码实现',
      description: '根据描述生成代码',
      action: () => onAIAction('template', 'code'),
    },
    {
      id: 'custom-prompt',
      icon: <MessageSquare className="h-4 w-4" />,
      title: '自由提问',
      description: '输入自定义指令',
      action: () => onAIAction('show-inline-prompt'),
    },
  ]
}
