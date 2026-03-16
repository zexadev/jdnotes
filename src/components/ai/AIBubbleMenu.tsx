import { BubbleMenu, type Editor } from '@tiptap/react'
import { 
  Sparkles, 
  FileText, 
  Languages, 
  Square, 
  Bold, 
  Italic, 
  Strikethrough, 
  Code as CodeIcon,
  Link as LinkIcon
} from 'lucide-react'
import { useAIStream, type AIAction } from '../../hooks/useAIStream'
import { useCallback, useState } from 'react'

interface AIBubbleMenuProps {
  editor: Editor
}

export function AIBubbleMenu({ editor }: AIBubbleMenuProps) {
  const [showError, setShowError] = useState<string | null>(null)

  const { isStreaming, startStream, stopStream } = useAIStream({
    onChunk: (chunk) => {
      editor.chain().focus().insertContent(chunk).run()
    },
    onFinish: () => {
    },
    onError: (error) => {
      setShowError(error)
      setTimeout(() => setShowError(null), 3000)
    },
  })

  const handleAIAction = useCallback(
    async (action: AIAction) => {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, ' ')

      if (!selectedText.trim()) return

      editor.chain().focus().deleteSelection().run()
      await startStream(action, selectedText)
    },
    [editor, startStream]
  )

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('输入链接地址', previousUrl)

    // 取消
    if (url === null) {
      return
    }

    // 清空
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    // 设置链接
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
      tippyOptions={{
        duration: 150,
        placement: 'top',
        offset: [0, 10],
      }}
      shouldShow={({ state }) => {
        const { from, to } = state.selection
        return from !== to && !editor.isActive('codeBlock')
      }}
    >
      <div className="flex items-center gap-0.5 px-1 py-1 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-in fade-in zoom-in duration-200">
        {isStreaming ? (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
            </div>
            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">AI 正在处理...</span>
            <button
              onClick={stopStream}
              className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          </div>
        ) : (
          <>
            {/* 常规格式化工具 */}
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

            {/* AI 功能工具 */}
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
            </div>
          </>
        )}

        {showError && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/90 text-red-600 dark:text-red-100 text-[11px] rounded-lg shadow-lg border border-red-100 dark:border-red-800 whitespace-nowrap animate-in slide-in-from-bottom-1">
            {showError}
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
