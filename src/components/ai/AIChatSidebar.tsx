import { useRef, useEffect, useCallback, useState } from 'react'
import { X, Send, Sparkles, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '../../hooks/useChat'
import { type ChatMessage } from '../../lib/db'
import { ChatMessageItem } from './ChatMessageItem'

// 临时流式消息类型
interface StreamingMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AIChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  noteId: number | null
  noteTitle: string
  noteContent: string
  onInsertToNote?: (content: string) => void
}

export function AIChatSidebar({ isOpen, onClose, noteId, noteTitle, noteContent, onInsertToNote }: AIChatSidebarProps) {
  const {
    input,
    setInput,
    messages,
    pendingUserMessage,
    streamingContent,
    isStreamingActive,
    isStreaming,
    isRetryMode,
    handleSend,
    handleEdit,
    handleDelete,
    handleRetry,
    handleClear,
  } = useChat({ noteId, noteTitle, noteContent })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isMultiLine, setIsMultiLine] = useState(false)

  // 滚动到底部
  const scrollToBottom = useCallback((instant = false) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: instant ? 'auto' : 'smooth'
      })
    }
  }, [])

  // 当消息更新时滚动到底部
  useEffect(() => {
    // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
    requestAnimationFrame(() => {
      scrollToBottom()
    })
  }, [messages, streamingContent, pendingUserMessage, scrollToBottom])

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      // 发送后重置输入框高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        setIsMultiLine(false)
      }
    }
  }

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 150)
      textarea.style.height = `${newHeight}px`
      // 判断是否为多行（超过单行高度约 24px）
      setIsMultiLine(newHeight > 36)
    }
  }

  // 输入框清空后重置高度
  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      setIsMultiLine(false)
    }
  }, [input])

  // 复制消息
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  if (!isOpen) return null

  // 合并数据库消息和临时流式消息
  const displayMessages: Array<ChatMessage | StreamingMessage & { id?: number }> = [
    ...(messages || []),
  ]

  // 如果有正在发送的消息，添加临时消息（重试模式不显示用户消息，因为已在数据库中）
  if (pendingUserMessage && !isRetryMode) {
    displayMessages.push({
      role: 'user' as const,
      content: pendingUserMessage,
    })
  }
  
  // 只有当有实际内容时才添加流式 AI 消息
  if (isStreamingActive && streamingContent) {
    displayMessages.push({
      role: 'assistant' as const,
      content: streamingContent,
    })
  }

  // 判断是否正在等待 AI 回复：
  // 1. 正在流式传输但还没有内容（等待第一个响应）
  // 2. 用户消息已发送，正在请求但还没开始流式响应
  const isWaitingForResponse = (isStreamingActive && !streamingContent) ||
    ((pendingUserMessage || isStreaming) && !isStreamingActive)

  return (
    <div className="w-[350px] ai-sidebar-glass border-l border-black/[0.03] dark:border-white/[0.06] flex flex-col h-full ai-chat-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.03] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#5E6AD2]" strokeWidth={1.5} />
          <span className="text-[14px] font-medium text-slate-900 dark:text-slate-100 tracking-tight">
            AI 助手
          </span>
        </div>
        <div className="flex items-center gap-1">
          {((messages && messages.length > 0) || pendingUserMessage) && (
            <button
              onClick={handleClear}
              className="px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded-md transition-colors"
            >
              清空
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Context Indicator */}
      <div className="px-4 py-2 border-b border-black/[0.03] dark:border-white/[0.06]">
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          正在阅读笔记：{noteTitle || '无标题'}
        </p>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {displayMessages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" strokeWidth={1} />
            <p className="text-[13px] text-slate-400 dark:text-slate-500">
              有什么可以帮你的？
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              我可以帮你分析笔记内容、回答问题
            </p>
          </motion.div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {displayMessages.map((msg, index) => {
                const isTemp = !('id' in msg) || msg.id === undefined
                const isCurrentStreaming = isTemp && msg.role === 'assistant'

                return (
                  <motion.div
                    key={isTemp ? `temp-${index}` : msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <ChatMessageItem
                      message={msg as ChatMessage}
                      isStreaming={isCurrentStreaming}
                      isTemporary={isTemp}
                      isAnyStreaming={isStreaming || isStreamingActive}
                      onCopy={handleCopy}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onRetry={handleRetry}
                      onInsertToNote={onInsertToNote}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
            
            {/* 等待 AI 回复的加载动画 */}
            <AnimatePresence>
              {isWaitingForResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="py-3 ai-thinking-indicator"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      AI
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="ai-thinking-dots">
                      <span className="ai-dot"></span>
                      <span className="ai-dot"></span>
                      <span className="ai-dot"></span>
                    </div>
                    <span className="text-[12px] text-slate-400 dark:text-slate-500 ml-1">
                      思考中...
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - 浮动输入框 */}
      <div className="p-4">
        <div className={`input-pill flex items-end gap-2 px-4 py-3 border border-black/[0.03] dark:border-white/[0.06] ${!isMultiLine ? 'single-line' : ''}`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-[13px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            style={{ maxHeight: '150px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={`p-1.5 rounded-lg transition-colors ${
              input.trim() && !isStreaming
                ? 'text-[#5E6AD2] hover:bg-[#5E6AD2]/10'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
          Shift + Enter 换行 · Enter 发送
        </p>
      </div>
    </div>
  )
}
