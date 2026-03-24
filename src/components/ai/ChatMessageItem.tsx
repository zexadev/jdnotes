import { useState, useRef, useEffect } from 'react'
import { Copy, Pencil, Trash2, RotateCcw, Check, FileInput } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../../lib/db'

interface ChatMessageItemProps {
  message: ChatMessage
  isStreaming?: boolean
  isTemporary?: boolean
  isAnyStreaming?: boolean
  onCopy: (content: string) => void
  onEdit: (id: number, newContent: string) => void
  onDelete: (id: number) => void
  onRetry: (message: ChatMessage) => void
  onInsertToNote?: (content: string) => void
}

export function ChatMessageItem({
  message,
  isStreaming,
  isTemporary,
  isAnyStreaming,
  onCopy,
  onEdit,
  onDelete,
  onRetry,
  onInsertToNote,
}: ChatMessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
      textarea.focus()
      textarea.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [editContent, isEditing])

  const handleCopy = () => {
    onCopy(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const isUser = message.role === 'user'

  // 用户消息：右对齐气泡
  if (isUser) {
    return (
      <div className="group flex flex-col items-end py-2">
        {/* 编辑模式 */}
        {isEditing ? (
          <div className="w-full flex flex-col gap-2 edit-message-container">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-white/80 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 border border-black/[0.06] dark:border-white/[0.06] rounded-lg px-3 py-2 text-[13px] resize-none outline-none focus:border-[#5E6AD2]/50 focus:ring-1 focus:ring-[#5E6AD2]/30 transition-all"
              rows={1}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Enter 发送 · Esc 取消
              </span>
              <div className="flex gap-1">
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-[11px] rounded-md text-slate-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-2 py-1 text-[11px] rounded-md bg-[#5E6AD2] text-white hover:bg-[#4F5ABF]"
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#5E6AD2] text-white text-[13px] leading-relaxed">
              <span className="whitespace-pre-wrap">{message.content}</span>
            </div>
            {/* 操作按钮 */}
            {!isStreaming && !isTemporary && (
              <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isAnyStreaming}
                  className={`p-1 rounded-md ${
                    isAnyStreaming
                      ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
                  }`}
                  title="编辑"
                >
                  <Pencil className="h-3 w-3" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                  title="删除"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // AI 消息：左对齐，无背景，直接展示 Markdown
  return (
    <div className="group py-3">
      {/* 消息内容 */}
      <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
        <div className="ai-chat-message prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || ' '}
          </ReactMarkdown>
          {isStreaming && <span className="ai-streaming-cursor" />}
        </div>
      </div>

      {/* 操作按钮 */}
      {!isEditing && !isStreaming && !isTemporary && (
        <div className="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            title="复制"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" strokeWidth={1.5} />
            )}
          </button>
          <button
            onClick={() => onRetry(message)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            title="重新生成"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
          </button>
          {onInsertToNote && (
            <button
              onClick={() => onInsertToNote(message.content)}
              className="p-1 rounded-md text-slate-400 hover:text-[#5E6AD2] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
              title="插入到笔记"
            >
              <FileInput className="h-3 w-3" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={() => onDelete(message.id)}
            className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            title="删除"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}
