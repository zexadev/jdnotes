import { useRef, useEffect, useCallback, useState } from 'react'
import { X, Send, Sparkles, Loader2, ChevronDown, Check, Plus, Trash2, Image, Copy, RotateCcw, FileInput } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChat } from '../../hooks/useChat'
import type { StreamSegment } from '../../hooks/useChat'
import { useAIConfig } from '../../hooks/useSettings'
import { type ChatMessage } from '../../lib/db'
import { ChatMessageItem } from './ChatMessageItem'

// 临时流式消息类型
interface StreamingMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
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
    pendingImages,
    streamingSegments,
    isStreamingActive,
    isStreaming,
    isRetryMode,
    conversations,
    activeConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    handleSend,
    sendMessage,
    handleEdit,
    handleDelete,
    handleRetry,
    handleClear,
  } = useChat({ noteId, noteTitle, noteContent })

  const { config, setActiveSource } = useAIConfig()
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [showConversationList, setShowConversationList] = useState(false)
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const sourcePickerRef = useRef<HTMLDivElement>(null)
  const conversationListRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeSource = config.sources.find(s => s.id === config.activeSourceId)
  const activeConversation = conversations.find(c => c.id === activeConversationId)

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

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom()
    })
  }, [messages, streamingSegments, pendingUserMessage, scrollToBottom])

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendWithImages()
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        setIsMultiLine(false)
      }
    }
  }

  // 发送消息（带图片）
  const handleSendWithImages = async () => {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    const images = attachedImages.length > 0 ? [...attachedImages] : undefined
    setAttachedImages([])
    await sendMessage(content, images)
  }

  // 图片附加
  const handleImageAttach = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        setAttachedImages(prev => [...prev, base64])
      }
      reader.readAsDataURL(file)
    })

    // 清空 input 以便重复选择同一文件
    e.target.value = ''
  }

  const removeAttachedImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
  }

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 150)
      textarea.style.height = `${newHeight}px`
      setIsMultiLine(newHeight > 36)
    }
  }

  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      setIsMultiLine(false)
    }
  }, [input])

  // 点击外部关闭弹出层
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourcePickerRef.current && !sourcePickerRef.current.contains(event.target as Node)) {
        setShowSourcePicker(false)
      }
      if (conversationListRef.current && !conversationListRef.current.contains(event.target as Node)) {
        setShowConversationList(false)
      }
    }
    if (showSourcePicker || showConversationList) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSourcePicker, showConversationList])

  // 复制消息
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  if (!isOpen) return null

  // 合并数据库消息和临时流式消息
  const displayMessages: Array<ChatMessage | StreamingMessage & { id?: number }> = [
    ...(messages || []),
  ]

  if (pendingUserMessage && !isRetryMode) {
    displayMessages.push({
      role: 'user' as const,
      content: pendingUserMessage,
      images: pendingImages,
    })
  }

  // 判断 segments 中是否有文字内容
  const hasStreamingText = streamingSegments.some(s => s.type === 'text' && s.content)
  const hasStreamingSegments = streamingSegments.length > 0

  const isWaitingForResponse = isStreamingActive && !hasStreamingSegments

  return (
    <div className="w-[350px] ai-sidebar-glass border-l border-black/[0.03] dark:border-white/[0.06] flex flex-col h-full ai-chat-sidebar">
      {/* Header — 对话操作 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.03] dark:border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="h-4 w-4 text-[#5E6AD2] flex-shrink-0" strokeWidth={1.5} />
          {/* 对话切换器 */}
          <div ref={conversationListRef} className="relative min-w-0">
            <button
              onClick={() => setShowConversationList(!showConversationList)}
              className="flex items-center gap-1 text-[14px] font-medium text-slate-900 dark:text-slate-100 tracking-tight hover:text-[#5E6AD2] transition-colors max-w-[180px]"
            >
              <span className="truncate">{activeConversation?.title || '对话'}</span>
              <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${showConversationList ? 'rotate-180' : ''}`} />
            </button>
            {showConversationList && (
              <div className="absolute top-full left-0 mt-1 w-56 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      conv.id === activeConversationId
                        ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => {
                        switchConversation(conv.id)
                        setShowConversationList(false)
                      }}
                      className="flex-1 text-left truncate"
                    >
                      {conv.title}
                    </button>
                    {conversations.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteConversation(conv.id)
                        }}
                        className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => createConversation()}
            className="p-1.5 text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-lg transition-colors"
            title="新建对话"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
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
              我可以读取、搜索和管理你的笔记
            </p>
          </motion.div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {displayMessages.map((msg, index) => {
                const isTemp = !('id' in msg) || msg.id === undefined

                // 跳过旧的 tool_call 消息（兼容）
                if (msg.role === 'tool_call') return null

                return (
                  <motion.div
                    key={isTemp ? `temp-${index}` : msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    {/* 图片预览（用户消息） */}
                    {'images' in msg && msg.images && msg.images.length > 0 && (
                      <div className="flex gap-1.5 mb-1.5 flex-wrap justify-end">
                        {msg.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img}
                            alt=""
                            className="h-16 w-16 object-cover rounded-lg border border-black/[0.06] dark:border-white/[0.06]"
                          />
                        ))}
                      </div>
                    )}
                    {/* assistant 消息：检查是否有 parts 结构 */}
                    {msg.role === 'assistant' ? (
                      <MessagePartsRenderer content={msg.content} isStreaming={false} onCopy={handleCopy} onDelete={handleDelete} onRetry={handleRetry} onInsertToNote={onInsertToNote} message={msg as ChatMessage} isAnyStreaming={isStreaming || isStreamingActive} />
                    ) : (
                      <ChatMessageItem
                        message={msg as ChatMessage}
                        isStreaming={false}
                        isTemporary={isTemp}
                        isAnyStreaming={isStreaming || isStreamingActive}
                        onCopy={handleCopy}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                        onInsertToNote={onInsertToNote}
                      />
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* 流式输出 segments */}
            {isStreamingActive && hasStreamingSegments && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-3"
              >
                <StreamingSegmentsRenderer segments={streamingSegments} isStreamingActive={isStreamingActive} />
              </motion.div>
            )}

            {/* 等待 AI 回复的加载动画 */}
            <AnimatePresence>
              {isWaitingForResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="ai-thinking-dots">
                      <span className="ai-dot"></span>
                      <span className="ai-dot"></span>
                      <span className="ai-dot"></span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 附加图片预览 */}
      {attachedImages.length > 0 && (
        <div className="px-4 py-2 border-t border-black/[0.03] dark:border-white/[0.06]">
          <div className="flex gap-1.5 flex-wrap">
            {attachedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img src={img} alt="" className="h-14 w-14 object-cover rounded-lg border border-black/[0.06] dark:border-white/[0.06]" />
                <button
                  onClick={() => removeAttachedImage(idx)}
                  className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4">
        {/* 模型选择器 */}
        <div ref={sourcePickerRef} className="relative mb-2">
          <button
            onClick={() => setShowSourcePicker(!showSourcePicker)}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#5E6AD2] transition-colors"
          >
            <span className="truncate">{activeSource?.name || 'AI'}</span>
            <span className="text-slate-400 dark:text-slate-500">·</span>
            <span className="text-slate-400 dark:text-slate-500 truncate">{activeSource?.model || ''}</span>
            <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${showSourcePicker ? 'rotate-180' : ''}`} />
          </button>
          {showSourcePicker && config.sources.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-56 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              {config.sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => {
                    setActiveSource(source.id)
                    setShowSourcePicker(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                    source.id === config.activeSourceId
                      ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{source.name}</div>
                    <div className="text-xs text-gray-400 truncate">{source.model}</div>
                  </div>
                  {source.id === config.activeSourceId && (
                    <Check className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={`input-pill flex items-end gap-2 px-4 py-3 border border-black/[0.03] dark:border-white/[0.06] ${!isMultiLine ? 'single-line' : ''}`}>
          {/* 图片附加按钮 */}
          <button
            onClick={handleImageAttach}
            className="p-1 text-slate-400 hover:text-[#5E6AD2] transition-colors flex-shrink-0"
            title="附加图片"
          >
            <Image className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
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
            onClick={handleSendWithImages}
            disabled={!input.trim() || isStreaming}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
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

// ============= Segments 渲染（流式 + 历史共用） =============

function renderSegments(segments: StreamSegment[], isStreaming: boolean) {
  return segments.map((seg, idx) => {
    if (seg.type === 'tool_call') {
      return <ToolCallCard key={`seg-${idx}`} name={seg.name} params={seg.params} result={seg.result} />
    }
    const isLastText = !segments.slice(idx + 1).some(s => s.type === 'text')
    return (
      <div key={`seg-${idx}`} className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
        <div className="ai-chat-message prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {seg.content || ' '}
          </ReactMarkdown>
          {isLastText && isStreaming && <span className="ai-streaming-cursor" />}
        </div>
      </div>
    )
  })
}

function StreamingSegmentsRenderer({ segments, isStreamingActive }: { segments: StreamSegment[]; isStreamingActive: boolean }) {
  return <>{renderSegments(segments, isStreamingActive)}</>
}

function MessagePartsRenderer({
  content, isStreaming, onCopy, onDelete, onRetry, onInsertToNote, message, isAnyStreaming,
}: {
  content: string
  isStreaming: boolean
  onCopy: (content: string) => void
  onDelete: (id: number) => void
  onRetry: (message: ChatMessage) => void
  onInsertToNote?: (content: string) => void
  message: ChatMessage
  isAnyStreaming: boolean
}) {
  // 尝试解析 parts 结构
  let parts: StreamSegment[] | null = null
  let plainText = content
  try {
    const parsed = JSON.parse(content)
    if (parsed && parsed.parts && Array.isArray(parsed.parts)) {
      parts = parsed.parts as StreamSegment[]
      // 提取纯文本用于复制
      plainText = parts.filter(p => p.type === 'text').map(p => (p as { content: string }).content).join('\n\n')
    }
  } catch {
    // 不是 JSON，按纯文本处理
  }

  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    onCopy(plainText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group py-3">
      {parts ? (
        // 带 tool calls 的 parts 结构
        renderSegments(parts, isStreaming)
      ) : (
        // 纯文本
        <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
          <div className="ai-chat-message prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || ' '}
            </ReactMarkdown>
          </div>
        </div>
      )}
      {/* 操作按钮 */}
      {!isStreaming && message.id && (
        <div className="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]" title="复制">
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
          </button>
          <button onClick={() => onRetry(message)} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]" title="重新生成">
            <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
          </button>
          {onInsertToNote && (
            <button onClick={() => onInsertToNote(plainText)} className="p-1 rounded-md text-slate-400 hover:text-[#5E6AD2] hover:bg-black/[0.03] dark:hover:bg-white/[0.06]" title="插入到笔记">
              <FileInput className="h-3 w-3" strokeWidth={1.5} />
            </button>
          )}
          <button onClick={() => onDelete(message.id)} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]" title="删除">
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

// ============= Tool Call 展示组件（Cursor 风格） =============

function ToolCallCard({ name, params, result }: { name: string; params: Record<string, unknown>; result?: string }) {
  const [expanded, setExpanded] = useState(false)

  const toolLabels: Record<string, { label: string; icon: string }> = {
    read_current_note: { label: '读取当前笔记', icon: '📄' },
    search_notes: { label: '搜索笔记', icon: '🔍' },
    read_note: { label: '读取笔记', icon: '📄' },
    list_tags: { label: '列出标签', icon: '🏷️' },
    get_notes_by_tag: { label: '按标签查找', icon: '🏷️' },
    create_note: { label: '创建笔记', icon: '📝' },
    update_note: { label: '修改笔记', icon: '✏️' },
    delete_note: { label: '删除笔记', icon: '🗑️' },
    get_note_images: { label: '获取图片', icon: '🖼️' },
  }

  const tool = toolLabels[name] || { label: name, icon: '🔧' }
  const paramSummary = Object.entries(params)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
    .join(', ')

  return (
    <div
      className="my-1 rounded-md border border-black/[0.04] dark:border-white/[0.06] bg-slate-50/80 dark:bg-white/[0.02] text-[11px] overflow-hidden cursor-pointer"
      onClick={() => result && setExpanded(!expanded)}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="flex-shrink-0 text-[10px]">{tool.icon}</span>
        <span className="font-medium text-slate-600 dark:text-slate-400">{tool.label}</span>
        {paramSummary && (
          <span className="text-slate-400 dark:text-slate-500 truncate flex-1 min-w-0">
            {paramSummary}
          </span>
        )}
        <span className="flex-shrink-0 ml-auto">
          {result ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          )}
        </span>
      </div>
      {expanded && result && (
        <div className="px-2.5 py-2 border-t border-black/[0.04] dark:border-white/[0.04] text-[10px] text-slate-500 dark:text-slate-400 max-h-28 overflow-y-auto">
          <pre className="whitespace-pre-wrap break-all font-mono leading-relaxed">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(result), null, 2).slice(0, 800)
              } catch {
                return result.slice(0, 800)
              }
            })()}
            {result.length > 800 ? '...' : ''}
          </pre>
        </div>
      )}
    </div>
  )
}
