import { useState, useRef, useEffect, useCallback } from 'react'
import { chatOperations, conversationOperations, type ChatMessage, type Conversation } from '../lib/db'
import { useAIStream, type AIMessage } from './useAIStream'
import type { AIToolContext } from '../lib/aiTools'

// 流式输出分段类型
export type StreamSegment =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; params: Record<string, unknown>; result?: string }

interface UseChatProps {
  noteId: number | null
  noteTitle: string
  noteContent: string
}

export function useChat({ noteId, noteTitle, noteContent }: UseChatProps) {
  const [input, setInput] = useState('')
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [isStreamingActive, setIsStreamingActive] = useState(false)
  const [isRetryMode, setIsRetryMode] = useState(false)

  // 多对话状态
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)

  // 流式输出分段：文字和 tool calls 穿插显示
  const [streamingSegments, setStreamingSegments] = useState<StreamSegment[]>([])
  const streamingSegmentsRef = useRef<StreamSegment[]>([])
  const lastSegmentWasToolRef = useRef(false)

  const streamTextRef = useRef('')
  const pendingUserMessageRef = useRef<string | null>(null)
  const pendingImagesRef = useRef<string[]>([])
  const noteIdRef = useRef<number | null>(null)
  const activeConversationIdRef = useRef<number | null>(null)
  const isRetryModeRef = useRef(false)

  // Sync refs
  useEffect(() => {
    pendingUserMessageRef.current = pendingUserMessage
    pendingImagesRef.current = pendingImages
    noteIdRef.current = noteId
    activeConversationIdRef.current = activeConversationId
    isRetryModeRef.current = isRetryMode
  }, [pendingUserMessage, pendingImages, noteId, activeConversationId, isRetryMode])

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Build tool context
  const buildToolContext = useCallback((): AIToolContext => ({
    currentNoteId: noteId,
    currentNoteTitle: noteTitle,
    currentNoteContent: noteContent,
  }), [noteId, noteTitle, noteContent])

  // Build system prompt (不再塞笔记内容，让模型通过 tools 按需获取)
  const buildSystemPrompt = useCallback(() => {
    return `你是 JD Notes 的 AI 助手。你可以通过工具读取、搜索、创建和修改笔记。

当前笔记：「${noteTitle || '无标题'}」(ID: ${noteId || '未知'})

重要规则：
- 当用户询问笔记内容时，使用 read_current_note 或 read_note 工具获取
- 当用户要搜索信息时，使用 search_notes 工具
- 当用户要创建或修改笔记时，使用对应的工具
- 不要猜测笔记内容，始终通过工具获取真实数据
- 用中文回复用户`
  }, [noteTitle, noteId])

  // Refresh conversations list
  const refreshConversations = useCallback(async () => {
    if (noteId) {
      try {
        const convs = await conversationOperations.getByNoteId(noteId)
        setConversations(convs)

        // 如果没有对话，自动创建一个
        if (convs.length === 0) {
          const newId = await conversationOperations.create(noteId, '对话 1')
          const updated = await conversationOperations.getByNoteId(noteId)
          setConversations(updated)
          setActiveConversationId(newId)
        } else if (!activeConversationId || !convs.find(c => c.id === activeConversationId)) {
          // 默认选中最新的对话
          setActiveConversationId(convs[0].id)
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
      }
    } else {
      setConversations([])
      setActiveConversationId(null)
    }
  }, [noteId, activeConversationId])

  // Refresh messages from database
  const refreshMessages = useCallback(async () => {
    if (activeConversationId) {
      try {
        const data = await chatOperations.getByConversationId(activeConversationId)
        setMessages(data)
      } catch (error) {
        console.error('Failed to load chat messages:', error)
      }
    } else {
      setMessages([])
    }
  }, [activeConversationId])

  // Load conversations when noteId changes
  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  // Load messages when activeConversationId changes
  useEffect(() => {
    refreshMessages()
  }, [refreshMessages])

  // AI Stream
  const { isStreaming, startStreamWithTools, stopStream } = useAIStream({
    onChunk: (chunk) => {
      streamTextRef.current += chunk
      // 如果上一个 segment 是 tool_call，新建一个 text segment
      const segs = streamingSegmentsRef.current
      if (lastSegmentWasToolRef.current || segs.length === 0) {
        segs.push({ type: 'text', content: chunk })
        lastSegmentWasToolRef.current = false
      } else {
        const last = segs[segs.length - 1]
        if (last.type === 'text') {
          last.content += chunk
        } else {
          segs.push({ type: 'text', content: chunk })
        }
      }
      streamingSegmentsRef.current = [...segs]
      setStreamingSegments([...segs])
    },
    onToolCall: (toolName, params) => {
      const segs = streamingSegmentsRef.current
      segs.push({ type: 'tool_call', name: toolName, params })
      lastSegmentWasToolRef.current = true
      streamingSegmentsRef.current = [...segs]
      setStreamingSegments([...segs])
    },
    onToolResult: (toolName, result) => {
      const segs = streamingSegmentsRef.current
      // 找到最后一个匹配的 tool_call 并更新 result
      for (let i = segs.length - 1; i >= 0; i--) {
        const seg = segs[i]
        if (seg.type === 'tool_call' && seg.name === toolName && !seg.result) {
          seg.result = result
          break
        }
      }
      streamingSegmentsRef.current = [...segs]
      setStreamingSegments([...segs])
    },
    onFinish: async (fullText) => {
      const cleanup = () => {
        setPendingUserMessage(null)
        setPendingImages([])
        setStreamingSegments([])
        streamingSegmentsRef.current = []
        lastSegmentWasToolRef.current = false
        setIsStreamingActive(false)
        setIsRetryMode(false)
        streamTextRef.current = ''
      }

      try {
        const currentNoteId = noteIdRef.current
        const convId = activeConversationIdRef.current
        const userMsg = pendingUserMessageRef.current
        const userImages = pendingImagesRef.current
        const isRetry = isRetryModeRef.current

        if (currentNoteId && convId) {
          if (!isRetry && userMsg) {
            await chatOperations.add(currentNoteId, 'user', userMsg, convId, userImages.length > 0 ? userImages : undefined)
          }
          // 保存 assistant 消息，content 包含 segments 结构（文字+tool calls 穿插）
          const segs = streamingSegmentsRef.current
          const hasTools = segs.some(s => s.type === 'tool_call')
          if (hasTools) {
            // 带 tool calls 的消息：保存完整 segments 结构
            await chatOperations.add(currentNoteId, 'assistant', JSON.stringify({ parts: segs }), convId)
          } else {
            // 纯文字消息：保存原始文本
            await chatOperations.add(currentNoteId, 'assistant', fullText, convId)
          }
        }

        cleanup()
        await refreshMessages()
      } catch (err) {
        console.error('Failed to save chat messages:', err)
        cleanup()
        // 即使保存失败也尝试刷新消息
        try { await refreshMessages() } catch { /* ignore */ }
      }
    },
    onError: async (error) => {
      const cleanup = () => {
        setPendingUserMessage(null)
        setPendingImages([])
        setStreamingSegments([])
        streamingSegmentsRef.current = []
        lastSegmentWasToolRef.current = false
        setIsStreamingActive(false)
        setIsRetryMode(false)
        streamTextRef.current = ''
      }

      try {
        const currentNoteId = noteIdRef.current
        const convId = activeConversationIdRef.current
        const userMsg = pendingUserMessageRef.current
        const userImages = pendingImagesRef.current
        const isRetry = isRetryModeRef.current

        if (currentNoteId && convId) {
          if (!isRetry && userMsg) {
            await chatOperations.add(currentNoteId, 'user', userMsg, convId, userImages.length > 0 ? userImages : undefined)
          }
          await chatOperations.add(currentNoteId, 'assistant', `错误: ${error}`, convId)
        }

        cleanup()
        await refreshMessages()
      } catch (err) {
        console.error('Failed to save error message:', err)
        cleanup()
      }
    },
  })

  // 构建 AI 消息历史
  const buildAIMessages = useCallback((userMessage: string, images?: string[]): AIMessage[] => {
    const aiMessages: AIMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
    ]

    // 添加历史消息
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const aiMsg: AIMessage = {
          role: msg.role,
          content: msg.content,
        }
        if (msg.role === 'user' && msg.images && msg.images.length > 0) {
          aiMsg.images = msg.images
        }
        aiMessages.push(aiMsg)
      }
    }

    // 添加当前用户消息
    const currentMsg: AIMessage = { role: 'user', content: userMessage }
    if (images && images.length > 0) {
      currentMsg.images = images
    }
    aiMessages.push(currentMsg)

    return aiMessages
  }, [messages, buildSystemPrompt])

  // Actions
  const sendMessage = useCallback(async (content: string, images?: string[]) => {
    if (!content.trim() || isStreaming || !noteId || !activeConversationId) return

    const trimmedContent = content.trim()
    const msgImages = images || []

    pendingUserMessageRef.current = trimmedContent
    pendingImagesRef.current = msgImages

    setPendingUserMessage(trimmedContent)
    setPendingImages(msgImages)
    setIsStreamingActive(true)
    setStreamingSegments([])
    streamingSegmentsRef.current = []
    lastSegmentWasToolRef.current = false
    streamTextRef.current = ''

    const aiMessages = buildAIMessages(trimmedContent, msgImages)
    await startStreamWithTools(aiMessages, buildToolContext())
  }, [noteId, activeConversationId, isStreaming, startStreamWithTools, buildAIMessages, buildToolContext])

  const handleSend = async () => {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    await sendMessage(content)
  }

  const handleEdit = useCallback(async (id: number, newContent: string) => {
    if (!noteId || !activeConversationId) return

    const currentMessages = await chatOperations.getByConversationId(activeConversationId)
    const editedMessage = currentMessages.find(m => m.id === id)
    if (editedMessage) {
      await chatOperations.deleteAfter(noteId, editedMessage.timestamp, activeConversationId)
    }

    await chatOperations.update(id, newContent)
    await refreshMessages()

    setIsRetryMode(true)
    setIsStreamingActive(true)
    setStreamingSegments([])
    streamingSegmentsRef.current = []
    lastSegmentWasToolRef.current = false
    streamTextRef.current = ''

    const aiMessages = buildAIMessages(newContent)
    await startStreamWithTools(aiMessages, buildToolContext())
  }, [noteId, activeConversationId, startStreamWithTools, buildAIMessages, buildToolContext, refreshMessages])

  const handleDelete = useCallback(async (id: number) => {
    await chatOperations.delete(id)
    await refreshMessages()
  }, [refreshMessages])

  const handleRetry = useCallback(async (message: ChatMessage) => {
    if (!noteId || !messages || !activeConversationId) return

    const messageIndex = messages.findIndex((m) => m.id === message.id)
    if (messageIndex <= 0) return

    const userMessage = messages[messageIndex - 1]
    if (userMessage.role !== 'user') return

    await chatOperations.delete(message.id)

    setIsRetryMode(true)
    setIsStreamingActive(true)
    setStreamingSegments([])
    streamingSegmentsRef.current = []
    lastSegmentWasToolRef.current = false
    streamTextRef.current = ''

    const aiMessages = buildAIMessages(userMessage.content, userMessage.images)
    await startStreamWithTools(aiMessages, buildToolContext())
  }, [noteId, activeConversationId, messages, startStreamWithTools, buildAIMessages, buildToolContext])

  const handleClear = useCallback(async () => {
    if (isStreaming) {
      stopStream()
    }
    if (activeConversationId) {
      await chatOperations.clearByConversationId(activeConversationId)
    }
    setPendingUserMessage(null)
    setPendingImages([])
    setStreamingSegments([])
    streamingSegmentsRef.current = []
    lastSegmentWasToolRef.current = false
    setIsStreamingActive(false)
    setIsRetryMode(false)
    streamTextRef.current = ''
    setMessages([])
  }, [isStreaming, activeConversationId, stopStream])

  // 对话管理
  const createConversation = useCallback(async (title?: string) => {
    if (!noteId) return
    const convTitle = title || `对话 ${conversations.length + 1}`
    const newId = await conversationOperations.create(noteId, convTitle)
    setActiveConversationId(newId)
    await refreshConversations()
  }, [noteId, conversations.length, refreshConversations])

  const switchConversation = useCallback(async (conversationId: number) => {
    if (isStreaming) stopStream()
    setActiveConversationId(conversationId)
    setPendingUserMessage(null)
    setPendingImages([])
    setStreamingSegments([])
    streamingSegmentsRef.current = []
    lastSegmentWasToolRef.current = false
    setIsStreamingActive(false)
    streamTextRef.current = ''
  }, [isStreaming, stopStream])

  const deleteConversation = useCallback(async (conversationId: number) => {
    await conversationOperations.delete(conversationId)
    if (activeConversationId === conversationId) {
      setActiveConversationId(null)
    }
    await refreshConversations()
  }, [activeConversationId, refreshConversations])

  const renameConversation = useCallback(async (conversationId: number, title: string) => {
    await conversationOperations.rename(conversationId, title)
    await refreshConversations()
  }, [refreshConversations])

  return {
    input,
    setInput,
    messages,
    pendingUserMessage,
    pendingImages,
    streamingSegments,
    isStreamingActive,
    isStreaming,
    isRetryMode,
    // 对话管理
    conversations,
    activeConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    // 消息操作
    handleSend,
    sendMessage,
    handleEdit,
    handleDelete,
    handleRetry,
    handleClear,
  }
}
