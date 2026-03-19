import { BubbleMenu } from '@tiptap/react/menus'
import { type Editor } from '@tiptap/react'
import {
  Sparkles,
  FileText,
  Languages,
  MessageSquare,
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  Link as LinkIcon,
  Send
} from 'lucide-react'
import type { AIAction } from '../../hooks/useAIStream'
import { useCallback, useState } from 'react'

interface AIBubbleMenuProps {
  editor: Editor
  onAIAction: (action: AIAction, customPrompt?: string) => void
}

export function AIBubbleMenu({ editor, onAIAction }: AIBubbleMenuProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

  const handleAIAction = useCallback(
    (action: AIAction) => {
      onAIAction(action)
    },
    [onAIAction]
  )

  const handleCustomPrompt = useCallback(() => {
    if (!customPrompt.trim()) return
    onAIAction('custom', customPrompt)
    setCustomPrompt('')
    setShowCustomInput(false)
  }, [customPrompt, onAIAction])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCustomPrompt()
    }
    if (e.key === 'Escape') {
      setShowCustomInput(false)
      setCustomPrompt('')
    }
  }

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('输入链接地址', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const aiItems = [
    { action: 'refine' as AIAction, icon: Sparkles, label: '改进写作' },
    { action: 'summarize' as AIAction, icon: FileText, label: '总结摘要' },
    { action: 'translate' as AIAction, icon: Languages, label: '翻译' },
  ]

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 10,
      }}
      shouldShow={({ state }: { state: any }) => {
        const { from, to } = state.selection
        return from !== to && !editor.isActive('codeBlock')
      }}
    >
      <div className="flex flex-col gap-0 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-in fade-in zoom-in duration-200">
        {showCustomInput ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="针对选中内容提问..."
              autoFocus
              className="w-48 px-2 py-1 text-xs text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleCustomPrompt}
              disabled={!customPrompt.trim()}
              className="p-1.5 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-3 w-3" />
            </button>
            <button
              onClick={() => { setShowCustomInput(false); setCustomPrompt('') }}
              className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 px-1 py-1">
            {/* 格式化工具 */}
            <div className="flex items-center px-1 border-r border-gray-100 dark:border-gray-800">
              <FormatButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive('bold')}
                icon={<Bold className="h-3.5 w-3.5" />}
                label="加粗"
              />
              <FormatButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive('italic')}
                icon={<Italic className="h-3.5 w-3.5" />}
                label="斜体"
              />
              <FormatButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive('strike')}
                icon={<Strikethrough className="h-3.5 w-3.5" />}
                label="删除线"
              />
              <FormatButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                active={editor.isActive('code')}
                icon={<CodeIcon className="h-3.5 w-3.5" />}
                label="内联代码"
              />
              <FormatButton
                onClick={setLink}
                active={editor.isActive('link')}
                icon={<LinkIcon className="h-3.5 w-3.5" />}
                label="插入链接"
              />
            </div>

            {/* AI 工具 */}
            <div className="flex items-center px-1">
              {aiItems.map(({ action, icon: Icon, label }) => (
                <button
                  key={action}
                  onClick={() => handleAIAction(action)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-lg transition-all"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
              <button
                onClick={() => setShowCustomInput(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-lg transition-all"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>提问</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  )
}

function FormatButton({ onClick, active, icon, label }: { onClick: () => void; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-all ${
        active
          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 dark:text-indigo-300'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
      title={label}
    >
      {icon}
    </button>
  )
}
