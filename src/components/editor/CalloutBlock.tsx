import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Info, AlertTriangle, Lightbulb, AlertCircle, X, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

type CalloutType = 'info' | 'warning' | 'tip' | 'error'

const CALLOUT_CONFIG: Record<CalloutType, {
  icon: typeof Info
  label: string
  bg: string
  border: string
  text: string
  iconColor: string
}> = {
  info: {
    icon: Info,
    label: '信息',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-l-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    iconColor: 'text-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    label: '警告',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-l-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    iconColor: 'text-amber-500',
  },
  tip: {
    icon: Lightbulb,
    label: '提示',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-l-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    iconColor: 'text-emerald-500',
  },
  error: {
    icon: AlertCircle,
    label: '错误',
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-l-red-500',
    text: 'text-red-700 dark:text-red-300',
    iconColor: 'text-red-500',
  },
}

const CALLOUT_TYPES: CalloutType[] = ['info', 'warning', 'tip', 'error']

function CalloutComponent({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const calloutType = (node.attrs.type as CalloutType) || 'info'
  const config = CALLOUT_CONFIG[calloutType]
  const Icon = config.icon
  const isEditable = editor.isEditable

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  return (
    <NodeViewWrapper className="my-4">
      <div className={`relative rounded-lg border-l-4 ${config.bg} ${config.border} px-4 py-3`}>
        {/* 头部：图标 + 类型标签 + 操作按钮 */}
        <div className="flex items-center gap-2 mb-1 select-none" contentEditable={false}>
          <Icon className={`h-4 w-4 flex-shrink-0 ${config.iconColor}`} />

          {/* 类型切换下拉 */}
          {isEditable ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${config.text} hover:opacity-80 transition-opacity`}
              >
                {config.label}
                <ChevronDown className="h-3 w-3" />
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 min-w-[100px]">
                  {CALLOUT_TYPES.map((t) => {
                    const c = CALLOUT_CONFIG[t]
                    const TypeIcon = c.icon
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          updateAttributes({ type: t })
                          setShowDropdown(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                          t === calloutType ? 'font-semibold' : ''
                        }`}
                      >
                        <TypeIcon className={`h-3.5 w-3.5 ${c.iconColor}`} />
                        <span className="text-gray-700 dark:text-gray-300">{c.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <span className={`text-xs font-semibold uppercase tracking-wide ${config.text}`}>
              {config.label}
            </span>
          )}

          {/* 删除按钮 */}
          {isEditable && (
            <button
              onClick={deleteNode}
              className="ml-auto p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
              title="删除"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 内容区域 */}
        <NodeViewContent className={`callout-content ${config.text} text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`} />
      </div>
    </NodeViewWrapper>
  )
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes) => ({
          'data-callout-type': attributes.type,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-type]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'callout-block' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent)
  },
})
