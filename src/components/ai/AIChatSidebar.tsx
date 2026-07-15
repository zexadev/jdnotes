import { useRef, useEffect, useCallback, useState } from 'react'
import { X, Sparkles, ChevronDown, Check, Plus, Trash2, FoldVertical, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '../../hooks/useChat'
import { useAIConfig } from '../../hooks/useSettings'
import { AUTO_COMPACT_RATIO } from '../../lib/contextBudget'
import {
  ChatInput,
  AssistantMessage,
  UserMessage,
  StreamingMessage,
  WaitingDots,
  useStickToBottom,
  ScrollToBottomButton,
  CompactDivider,
} from './chat'

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
    statusText,
    isCompacting,
    contextUsage,
    canCompact,
    handleCompact,
    conversations,
    activeConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    sendMessage,
    handleEdit,
    handleDelete,
    handleRetry,
    handleClear,
    handleStop,
  } = useChat({ noteId, noteTitle, noteContent })

  const { config, setActiveSource } = useAIConfig()
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [showConversationList, setShowConversationList] = useState(false)
  const [attachedImages, setAttachedImages] = useState<string[]>([])
  const sourcePickerRef = useRef<HTMLDivElement>(null)
  const conversationListRef = useRef<HTMLDivElement>(null)

  const activeSource = config.sources.find(s => s.id === config.activeSourceId)
  const activeConversation = conversations.find(c => c.id === activeConversationId)

  // 智能粘底：用户在底部才跟随流式输出，翻阅历史不打扰
  const { containerRef, isAtBottom, scrollToBottom, handleScroll } = useStickToBottom([
    messages,
    streamingSegments,
    pendingUserMessage,
  ])

  // 切换对话：直接落到底部（上一对话的滚动位置对新对话无意义）
  useEffect(() => {
    scrollToBottom('auto')
  }, [activeConversationId, scrollToBottom])

  const handleSendWithImages = async () => {
    if (!input.trim() && attachedImages.length === 0) return
    const content = input.trim()
    setInput('')
    const images = attachedImages.length > 0 ? [...attachedImages] : undefined
    setAttachedImages([])
    const sent = await sendMessage(content, images)
    // 发送被取消/拒绝（如压缩阶段按了停止、正在流式中）：内容还回输入区，不静默丢失
    if (!sent) {
      if (content) setInput((cur) => cur || content)
      if (images && images.length > 0) setAttachedImages((cur) => (cur.length > 0 ? cur : images))
    }
  }

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

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  if (!isOpen) return null

  const hasStreamingSegments = streamingSegments.length > 0
  const isWaitingForResponse = isStreamingActive && !hasStreamingSegments
  const isEmpty = (messages?.length ?? 0) === 0 && !pendingUserMessage

  return (
    <div
      className="w-[350px] ai-sidebar-glass border-l border-black/[0.03] dark:border-white/[0.06] flex flex-col h-full ai-chat-sidebar"
      // 侧栏内任意位置按 Esc 停止生成（不聚焦输入框也能停；不动全局，避免与图片预览等 Esc 冲突）
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape' && (isStreaming || isStreamingActive || isCompacting)) {
          e.stopPropagation()
          handleStop()
        }
      }}
    >
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
              <div className="absolute top-full left-0 mt-1 w-56 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      conv.id === activeConversationId
                        ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
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
          {canCompact && (
            <button
              onClick={handleCompact}
              disabled={isStreaming || isStreamingActive || isCompacting}
              className="p-1.5 text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="压缩上下文：把对话总结成摘要，之后只携带摘要继续（消息记录保留）"
            >
              {isCompacting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                : <FoldVertical className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          )}
          {!isEmpty && (
            <button
              onClick={handleClear}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] rounded-md transition-colors"
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
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto overflow-x-hidden px-4 py-4">
          {isEmpty && !isStreamingActive ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" strokeWidth={1} />
              <p className="text-[13px] text-slate-400 dark:text-slate-500">有什么可以帮你的？</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">我可以读取、搜索和管理你的笔记</p>
            </motion.div>
          ) : (
            <div>
              <AnimatePresence mode="popLayout" initial={false}>
                {(messages || []).map((msg) => {
                  if (msg.role === 'summary') {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                        layout="position"
                        layoutDependency={messages}
                      >
                        <CompactDivider summary={msg.content} onDelete={() => handleDelete(msg.id)} />
                      </motion.div>
                    )
                  }
                  if (msg.role !== 'user' && msg.role !== 'assistant') return null
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.18 }}
                      layout="position"
                      // 只在消息增删时做布局测量：不加的话每个流式 chunk 都对全部历史消息
                      // 做一次 getBoundingClientRect，长对话里主线程被吃满
                      layoutDependency={messages}
                    >
                      {msg.role === 'user' ? (
                        <UserMessage
                          message={msg}
                          isAnyStreaming={isStreaming || isStreamingActive || isCompacting}
                          onCopy={handleCopy}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ) : (
                        <AssistantMessage
                          message={msg}
                          isAnyStreaming={isStreaming || isStreamingActive || isCompacting}
                          onCopy={handleCopy}
                          onDelete={handleDelete}
                          onRetry={handleRetry}
                          onInsertToNote={onInsertToNote}
                        />
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* 发送中的临时用户消息 */}
              {pendingUserMessage && !isRetryMode && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                  <UserMessage
                    message={{ content: pendingUserMessage, images: pendingImages }}
                    isTemporary
                    isAnyStreaming
                    onCopy={handleCopy}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </motion.div>
              )}

              {/* 流式输出 */}
              {isStreamingActive && hasStreamingSegments && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                  <StreamingMessage segments={streamingSegments} />
                </motion.div>
              )}

              {/* 等待首个响应 / 瞬态状态行（自动重试倒计时、上下文压缩中）——同一容器切换，避免双行叠放跳动 */}
              <AnimatePresence>
                {(statusText || isWaitingForResponse) && (
                  <motion.div
                    key="status-line"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {statusText ? (
                      <div className="flex items-center gap-2 py-2 text-[11px] text-slate-400 dark:text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                        <span>{statusText}</span>
                      </div>
                    ) : (
                      <WaitingDots />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
        <ScrollToBottomButton visible={!isAtBottom} onClick={() => scrollToBottom()} />
      </div>

      {/* Input Area */}
      <div className="p-4 pt-2">
        {/* 模型选择器 + 上下文占用 */}
        <div ref={sourcePickerRef} className="relative mb-2 flex items-center justify-between gap-2">
          <button
            onClick={() => setShowSourcePicker(!showSourcePicker)}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#5E6AD2] transition-colors min-w-0"
          >
            <span className="truncate">{activeSource?.name || 'AI'}</span>
            <span className="text-slate-400 dark:text-slate-500">·</span>
            <span className="text-slate-400 dark:text-slate-500 truncate">{activeSource?.model || ''}</span>
            <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${showSourcePicker ? 'rotate-180' : ''}`} />
          </button>
          {contextUsage.ratio >= 0.05 && (
            <span
              className="flex-shrink-0 flex items-center gap-1.5"
              title={`预计上下文占用 ${(contextUsage.tokens / 1000).toFixed(1)}k / ${contextUsage.limit >= 1_000_000 ? `${contextUsage.limit / 1_000_000}M` : `${Math.round(contextUsage.limit / 1000)}k`} tokens（模型窗口，可在设置中手填），超过 ${Math.round(AUTO_COMPACT_RATIO * 100)}% 发送时自动压缩`}
            >
              <span className="w-10 h-[3px] rounded-full bg-black/[0.08] dark:bg-white/[0.12] overflow-hidden">
                <span
                  className={`block h-full rounded-full transition-all duration-300 ${
                    contextUsage.ratio >= 0.9
                      ? 'bg-red-500'
                      : contextUsage.ratio >= AUTO_COMPACT_RATIO
                        ? 'bg-amber-500'
                        : 'bg-slate-400/80 dark:bg-slate-500'
                  }`}
                  style={{ width: `${Math.max(4, Math.round(contextUsage.ratio * 100))}%` }}
                />
              </span>
              <span
                className={`text-[10px] tabular-nums ${
                  contextUsage.ratio >= 0.9
                    ? 'text-red-500'
                    : contextUsage.ratio >= AUTO_COMPACT_RATIO
                      ? 'text-amber-500'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {Math.round(contextUsage.ratio * 100)}%
              </span>
            </span>
          )}
          {showSourcePicker && config.sources.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-56 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
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
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{source.name}</div>
                    <div className="text-xs text-slate-400 truncate">{source.model}</div>
                  </div>
                  {source.id === config.activeSourceId && <Check className="h-4 w-4 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSendWithImages}
          onStop={handleStop}
          isStreaming={isStreaming || isStreamingActive || isCompacting}
          attachedImages={attachedImages}
          onAttachImages={(images) => setAttachedImages((prev) => [...prev, ...images])}
          onRemoveImage={(index) => setAttachedImages((prev) => prev.filter((_, i) => i !== index))}
        />
      </div>
    </div>
  )
}
