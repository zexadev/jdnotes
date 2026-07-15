import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { chatOperations, conversationOperations, type ChatMessage, type Conversation } from '../lib/db'
import { useAIStream, generateOnce, type AIMessage } from './useAIStream'
import type { AIToolContext } from '../lib/aiTools'
import { contentForModel, serializeForCompact, type StreamSegment, type MessageParts } from '../lib/chatParts'
import { DEFAULT_CONTEXT_WINDOW, AUTO_COMPACT_RATIO, COMPACT_SYSTEM_PROMPT, IMAGE_TOKENS, TOOL_DEFS_OVERHEAD, estimateTokens, estimateMessagesTokens } from '../lib/contextBudget'
import { useSettings } from './useSettings'
import { toast } from '../lib/toast'

export type { StreamSegment, MessageParts }

// 对话自动命名的系统提示
const TITLE_SYSTEM_PROMPT = '为这段对话起一个简短标题：4~12 个字，直接概括主题，用对话使用的语言。只输出标题本身，不要引号、标点或任何解释。'
// 默认标题形如「对话 1」——只有仍是默认名时才自动命名，用户改过的名字绝不覆盖
const DEFAULT_TITLE_RE = /^对话 \d+$/

// 找最后一个压缩点：之前的历史由摘要代表，之后的消息原样携带
function splitAtLastSummary(history: ChatMessage[]): { summary: string | null; recent: ChatMessage[] } {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'summary') {
      return { summary: history[i].content, recent: history.slice(i + 1) }
    }
  }
  return { summary: null, recent: history }
}

interface UseChatProps {
  noteId: number | null
  noteTitle: string
  noteContent: string
}

export function useChat({ noteId, noteTitle, noteContent }: UseChatProps) {
  // 当前激活来源的上下文窗口（手填 > 按模型名推断 > 64k 兜底），切换来源即时生效
  const { settings } = useSettings()
  const contextLimit = settings.aiContextWindow || DEFAULT_CONTEXT_WINDOW
  const contextLimitRef = useRef(contextLimit)
  contextLimitRef.current = contextLimit

  const [input, setInput] = useState('')
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [isStreamingActive, setIsStreamingActive] = useState(false)
  const [isRetryMode, setIsRetryMode] = useState(false)
  // 瞬态状态行（自动重试倒计时、压缩进行中…），不落库
  const [statusText, setStatusText] = useState<string | null>(null)
  // 手动压缩进行中（自动压缩走 isStreamingActive 的生命周期）
  const [isCompacting, setIsCompacting] = useState(false)
  const compactAbortRef = useRef<AbortController | null>(null)
  // 本次流所属的笔记/对话：落库一律用它而不是活引用——用户中途切换笔记/对话时，
  // 活引用已指向新目标，消息会写错地方
  const streamTargetRef = useRef<{ noteId: number; convId: number } | null>(null)
  // 发送流程正处于「自动压缩」阶段（请求尚未发出）：中断时不该把用户消息落库成已发送
  const compactPhaseRef = useRef(false)

  // 多对话状态
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)

  // 流式输出分段：思考、文字和 tool calls 穿插显示
  const [streamingSegments, setStreamingSegments] = useState<StreamSegment[]>([])
  const streamingSegmentsRef = useRef<StreamSegment[]>([])
  const lastSegmentWasToolRef = useRef(false)
  // 当前打开的思考段的开始时间（文字/工具到达即封口计时长）
  const thinkingStartRef = useRef<number | null>(null)
  // 用户按过停止（工具执行期间 abort 走 onFinish 而非 onAborted，靠它补 stopped 标记）
  const userStoppedRef = useRef(false)
  // 清空/切换对话时置位：流式回调落库直接跳过（否则 persist 与 DELETE 竞态会让消息复活）
  const skipPersistRef = useRef(false)

  const streamTextRef = useRef('')
  const pendingUserMessageRef = useRef<string | null>(null)
  const pendingImagesRef = useRef<string[]>([])
  const noteIdRef = useRef<number | null>(null)
  const activeConversationIdRef = useRef<number | null>(null)
  const isRetryModeRef = useRef(false)
  const conversationsRef = useRef<Conversation[]>([])
  // 正在自动命名的对话（防止同一对话并发起名）
  const autoTitlingRef = useRef<Set<number>>(new Set())

  // Sync refs
  useEffect(() => {
    pendingUserMessageRef.current = pendingUserMessage
    pendingImagesRef.current = pendingImages
    noteIdRef.current = noteId
    activeConversationIdRef.current = activeConversationId
    isRetryModeRef.current = isRetryMode
  }, [pendingUserMessage, pendingImages, noteId, activeConversationId, isRetryMode])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Build tool context
  const buildToolContext = useCallback((): AIToolContext => ({
    currentNoteId: noteId,
    currentNoteTitle: noteTitle,
    currentNoteContent: noteContent,
  }), [noteId, noteTitle, noteContent])

  // Build system prompt (不塞笔记内容，让模型通过 tools 按需获取)
  // summary 非空时附「早前对话摘要」节：压缩点之前的原始消息不再回传，摘要是唯一来源
  const buildSystemPrompt = useCallback((summary?: string | null) => {
    const now = new Date()
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

    let prompt = `你是 Lapis 的 AI 助手。当前时间：${dateStr}。

你拥有以下能力：
1. **笔记操作**：列出、读取、搜索、创建、追加、修改、删除笔记
2. **联网**：web_search 搜索互联网，web_fetch 读取网页正文

当前笔记：「${noteTitle || '无标题'}」(ID: ${noteId || '未知'})

工具使用规则：
- 操作笔记一律先拿到 id：list_notes / search_notes 的结果里带 id
- 读当前笔记用 read_current_note；读其它笔记用 read_note（可按 id 或标题）
- 长笔记的读取结果会截断，按提示用 offset 继续读
- 往已有笔记补充内容用 append_note；update_note 的 content 会整篇覆盖，改前先 read_note 确认
- 需要最新信息或不确定的事实时用 web_search；用户给了 URL 用 web_fetch
- 不要猜测笔记内容，始终通过工具获取真实数据
- 用中文回复用户`

    if (summary) {
      prompt += `\n\n## 早前对话摘要\n此前的对话上下文已压缩，压缩点之前的原始消息不再附带，以下摘要是其唯一来源：\n${summary}`
    }
    return prompt
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

  // Refresh messages from database（可指定对话，避免闭包里的旧 id）
  const refreshMessages = useCallback(async (conversationId?: number | null) => {
    const convId = conversationId ?? activeConversationIdRef.current
    if (convId) {
      try {
        const data = await chatOperations.getByConversationId(convId)
        setMessages(data)
        return data
      } catch (error) {
        console.error('Failed to load chat messages:', error)
      }
    } else {
      setMessages([])
    }
    return []
  }, [])

  // 对话自动命名：首轮问答落库后异步起名（fire-and-forget）。
  // 仅当标题仍是默认「对话 N」时才动它；期间用户手动改名则放弃；失败保持默认，完全无感
  const maybeAutoTitleConversation = useCallback(async (ownerNoteId: number, convId: number) => {
    const conv = conversationsRef.current.find((c) => c.id === convId)
    if (!conv || !DEFAULT_TITLE_RE.test(conv.title)) return
    if (autoTitlingRef.current.has(convId)) return
    autoTitlingRef.current.add(convId)
    try {
      const msgs = await chatOperations.getByConversationId(convId)
      const firstUser = msgs.find((m) => m.role === 'user')
      const firstAssistant = msgs.find((m) => m.role === 'assistant')
      if (!firstUser || !firstAssistant) return
      const material = `用户：${firstUser.content.slice(0, 500)}\n助手：${contentForModel(firstAssistant.content).slice(0, 300)}`

      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 20_000)
      let title = ''
      try {
        title = await generateOnce(TITLE_SYSTEM_PROMPT, material, ac.signal)
      } finally {
        clearTimeout(timer)
      }
      title = title.split('\n')[0].replace(/^["'「『【《\s]+|["'」』】》。，！？!?,.\s]+$/g, '').slice(0, 24)
      if (!title || DEFAULT_TITLE_RE.test(title)) return

      // 起名期间用户可能自己改了名：以库里最新标题为准，改过就不覆盖
      const latest = (await conversationOperations.getByNoteId(ownerNoteId)).find((c) => c.id === convId)
      if (!latest || !DEFAULT_TITLE_RE.test(latest.title)) return
      await conversationOperations.rename(convId, title)
      await refreshConversations()
    } catch { /* 命名失败保持默认标题 */ }
    finally {
      autoTitlingRef.current.delete(convId)
    }
  }, [refreshConversations])

  // Load conversations when noteId changes
  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  // Load messages when activeConversationId changes
  useEffect(() => {
    refreshMessages(activeConversationId)
  }, [refreshMessages, activeConversationId])

  // ============= 流式文本平滑层 =============
  // 中转商常一次吐大块文本，直接上屏是跳跃式的；把 chunk 排进缓冲区，
  // rAF 匀速排出（积压越多排得越快），得到 Cursor 式的平滑打字感。
  const pendingTextRef = useRef('')
  const drainRafRef = useRef<number | null>(null)

  const appendVisibleText = (text: string) => {
    const segs = streamingSegmentsRef.current
    if (lastSegmentWasToolRef.current || segs.length === 0) {
      segs.push({ type: 'text', content: text })
      lastSegmentWasToolRef.current = false
    } else {
      const last = segs[segs.length - 1]
      if (last.type === 'text') {
        last.content += text
      } else {
        segs.push({ type: 'text', content: text })
      }
    }
    streamingSegmentsRef.current = [...segs]
    setStreamingSegments([...segs])
  }

  const drainLoop = () => {
    const buf = pendingTextRef.current
    if (buf.length === 0) {
      drainRafRef.current = null
      return
    }
    // 每帧 1~24 字符（60fps 下 60~1440 字/秒）：下限保打字感，上限封顶追赶速度——
    // 中转商一次吐上千字时不至于瞬间铺满，快速供应商持续流也不会积压
    const n = Math.min(24, Math.max(1, Math.ceil(buf.length / 25)))
    pendingTextRef.current = buf.slice(n)
    appendVisibleText(buf.slice(0, n))
    drainRafRef.current = requestAnimationFrame(drainLoop)
  }

  const queueText = (chunk: string) => {
    pendingTextRef.current += chunk
    if (drainRafRef.current === null) {
      drainRafRef.current = requestAnimationFrame(drainLoop)
    }
  }

  // 工具/思考段到达或停止/出错时，把缓冲区立即冲完，保证段顺序与落库完整性
  const flushPendingText = () => {
    if (drainRafRef.current !== null) {
      cancelAnimationFrame(drainRafRef.current)
      drainRafRef.current = null
    }
    if (pendingTextRef.current) {
      const text = pendingTextRef.current
      pendingTextRef.current = ''
      appendVisibleText(text)
    }
  }

  // 正常完成：等排字动画自然排完再落库——中转商常整段一次到达后立刻结束，
  // 结束即 flush 会把动画整段拍死（正是"流式很难受"的来源）。
  // 兜底 5s（窗口后台时 rAF 停转）；用户中途按停止立即冲完
  const waitForDrain = () =>
    new Promise<void>((resolve) => {
      const deadline = Date.now() + 5000
      const check = () => {
        if (pendingTextRef.current.length === 0 || userStoppedRef.current || Date.now() > deadline) {
          flushPendingText()
          resolve()
        } else {
          setTimeout(check, 50)
        }
      }
      check()
    })

  // 封口当前打开的思考段（记录时长）；文字/工具/结束都会触发
  const closeOpenThinking = () => {
    if (thinkingStartRef.current === null) return
    const segs = streamingSegmentsRef.current
    const last = segs[segs.length - 1]
    if (last && last.type === 'thinking' && last.durationMs === undefined) {
      last.durationMs = Date.now() - thinkingStartRef.current
    }
    thinkingStartRef.current = null
  }

  // AI Stream
  const { isStreaming, startStreamWithTools, stopStream } = useAIStream({
    onReasoning: (chunk) => {
      flushPendingText()
      const segs = streamingSegmentsRef.current
      const last = segs[segs.length - 1]
      if (last && last.type === 'thinking' && last.durationMs === undefined) {
        last.content += chunk
      } else {
        segs.push({ type: 'thinking', content: chunk })
        thinkingStartRef.current = Date.now()
      }
      lastSegmentWasToolRef.current = false
      streamingSegmentsRef.current = [...segs]
      setStreamingSegments([...segs])
    },
    onChunk: (chunk) => {
      closeOpenThinking()
      streamTextRef.current += chunk
      queueText(chunk)
    },
    onToolCall: (toolName, params) => {
      flushPendingText()
      closeOpenThinking()
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
    onFinish: (fullText) => persistStreamed(fullText, false),
    // 停止/出错都保留已流出的内容；错误以文字段并入同一条消息（分成两条会破坏重试语义）
    onAborted: () => persistStreamed(streamTextRef.current, true),
    onError: (error) => persistStreamed(streamTextRef.current, false, error),
    // 瞬态提示（自动重试等待中…）
    onNotice: (text) => setStatusText(text),
  })

  const cleanupStreamState = () => {
    if (drainRafRef.current !== null) {
      cancelAnimationFrame(drainRafRef.current)
      drainRafRef.current = null
    }
    pendingTextRef.current = ''
    setPendingUserMessage(null)
    setPendingImages([])
    setStreamingSegments([])
    streamingSegmentsRef.current = []
    lastSegmentWasToolRef.current = false
    thinkingStartRef.current = null
    userStoppedRef.current = false
    setIsStreamingActive(false)
    setIsRetryMode(false)
    setStatusText(null)
    streamTextRef.current = ''
    streamTargetRef.current = null
    compactPhaseRef.current = false
  }

  // 完成 / 停止 / 出错的统一落库：用户消息 + 已生成的 assistant 内容（+ 错误信息并入同条消息）。
  // 顺序刻意为「先写库 → 刷消息 → 再清流式态」：setMessages 与清理在同一批 commit，
  // 结束瞬间不会出现消息闪没再淡入的空档。
  async function persistStreamed(fullText: string, stoppedParam: boolean, errorText?: string) {
    // 清空/切换对话主动放弃本次落库（与 DELETE/切换的竞态会让消息复活或写错对话）
    if (skipPersistRef.current) {
      cleanupStreamState()
      return
    }
    if (!stoppedParam && !errorText) {
      await waitForDrain()
    } else {
      flushPendingText()
    }
    // waitForDrain 最长挂 5 秒——清空/切换若落在这个窗口，必须再查一次，
    // 否则消息在 DELETE 之后 INSERT 回来（复活）
    if (skipPersistRef.current) {
      cleanupStreamState()
      return
    }
    closeOpenThinking()
    const stopped = stoppedParam || userStoppedRef.current
    try {
      // 落库到流开始时捕获的目标：流进行中用户可能已切换笔记/对话
      const target = streamTargetRef.current
      const currentNoteId = target?.noteId ?? noteIdRef.current
      const convId = target?.convId ?? activeConversationIdRef.current
      const userMsg = pendingUserMessageRef.current
      const userImages = pendingImagesRef.current
      const isRetry = isRetryModeRef.current

      if (currentNoteId && convId) {
        if (!isRetry && userMsg) {
          await chatOperations.add(currentNoteId, 'user', userMsg, convId, userImages.length > 0 ? userImages : undefined)
        }
        const segs = [...streamingSegmentsRef.current]
        if (errorText) {
          segs.push({ type: 'text', content: `错误: ${errorText}` })
        }
        // 含思考/工具段或被停止的消息存 JSON parts，纯文字存原文（DB 可读 + 向后兼容）
        const needsParts = stopped || segs.some(s => s.type !== 'text')
        if (segs.length > 0 && needsParts) {
          const payload: MessageParts = stopped ? { parts: segs, stopped: true } : { parts: segs }
          await chatOperations.add(currentNoteId, 'assistant', JSON.stringify(payload), convId)
        } else if (errorText) {
          await chatOperations.add(currentNoteId, 'assistant', `错误: ${errorText}`, convId)
        } else if (fullText) {
          await chatOperations.add(currentNoteId, 'assistant', fullText, convId)
        }
        // 视图已经切到别的对话就不刷新（会把旧对话消息灌进新视图）
        if (activeConversationIdRef.current === convId) {
          await refreshMessages(convId)
        }
        // 默认标题的对话起个名（异步，不阻塞收尾）
        void maybeAutoTitleConversation(currentNoteId, convId)
      }

      cleanupStreamState()
    } catch (err) {
      console.error('Failed to save chat messages:', err)
      cleanupStreamState()
      try { await refreshMessages() } catch { /* ignore */ }
    }
  }

  // 停止生成：中断请求（含进行中的上下文压缩），已流出的内容由 onAborted/onFinish 落库保留
  const handleStop = useCallback(() => {
    userStoppedRef.current = true
    compactAbortRef.current?.abort()
    stopStream()
  }, [stopStream])

  // 构建 AI 消息历史（可传入自定义消息列表，避免 state 延迟问题）。
  // assistant 历史必须还原成纯文本：parts JSON 原样回传会把思考全文和 JSON 结构喂给模型。
  // 存在压缩点时，之前的消息由系统提示里的摘要代表，只携带压缩点之后的消息
  const buildAIMessages = useCallback((userMessage: string, images?: string[], historyOverride?: ChatMessage[]): AIMessage[] => {
    const history = historyOverride ?? messages
    const { summary, recent } = splitAtLastSummary(history)

    const aiMessages: AIMessage[] = [
      { role: 'system', content: buildSystemPrompt(summary) },
    ]

    for (const msg of recent) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const content = msg.role === 'assistant' ? contentForModel(msg.content) : msg.content
        if (!content && msg.role === 'assistant') continue
        const aiMsg: AIMessage = { role: msg.role, content }
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

  // ============= 上下文压缩（compact） =============

  // 让模型把当前有效历史总结成摘要，落库为 summary 消息（压缩点）。
  // 界面上历史消息完整保留，之后的请求只携带「系统提示+摘要+压缩点后的消息」。
  // 返回压缩后的最新消息列表；无可压缩内容返回 null
  const runCompaction = useCallback(async (history: ChatMessage[]): Promise<ChatMessage[] | null> => {
    const currentNoteId = noteIdRef.current
    const convId = activeConversationIdRef.current
    if (!currentNoteId || !convId) return null

    const { summary, recent } = splitAtLastSummary(history)
    let printable = recent.filter((m) => m.role === 'user' || m.role === 'assistant')
    if (printable.length < 2) return null

    const prior = summary ? [{ role: 'summary', content: summary }] : []
    let serialized = serializeForCompact([...prior, ...printable])
    // 摘要请求自身也不能撑爆窗口：过长时丢最旧的四分之一重试
    let droppedOldest = false
    while (printable.length > 4 && estimateTokens(serialized) > contextLimitRef.current * 0.75) {
      printable = printable.slice(Math.ceil(printable.length / 4))
      droppedOldest = true
      serialized = serializeForCompact([...prior, ...printable])
    }
    if (droppedOldest) {
      serialized = '（更早的部分消息因过长未纳入本次摘要）\n\n' + serialized
    }

    const ac = new AbortController()
    compactAbortRef.current = ac
    try {
      const summaryText = await generateOnce(COMPACT_SYSTEM_PROMPT, serialized, ac.signal)
      // abort 落在 generateOnce 已完成的尾窗：摘要不落库（清空/切换的意图优先）
      if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (!summaryText) return null
      // 对话/笔记已切走：过期摘要直接作废，落库会在别的视图下制造错位压缩点
      if (activeConversationIdRef.current !== convId || noteIdRef.current !== currentNoteId) return null
      await chatOperations.add(currentNoteId, 'summary', summaryText, convId)
      if (ac.signal.aborted || activeConversationIdRef.current !== convId) return null
      return await refreshMessages(convId)
    } finally {
      if (compactAbortRef.current === ac) compactAbortRef.current = null
    }
  }, [refreshMessages])

  // 手动压缩（侧栏按钮）
  const handleCompact = useCallback(async () => {
    if (isStreaming || isStreamingActive || isCompacting) return
    setIsCompacting(true)
    setStatusText('正在压缩上下文…')
    try {
      const fresh = await runCompaction(messages)
      if (!fresh) toast.info('没有可压缩的对话内容')
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        console.error('压缩上下文失败:', e)
        toast.error('压缩失败：' + (e instanceof Error ? e.message : String(e)))
      }
    } finally {
      setIsCompacting(false)
      setStatusText(null)
    }
  }, [isStreaming, isStreamingActive, isCompacting, messages, runCompaction])

  // 预计上下文占用（系统提示+工具定义+摘要+压缩点后的消息），供指示器与自动压缩共用口径
  const contextUsage = useMemo(() => {
    const { summary, recent } = splitAtLastSummary(messages)
    let tokens = estimateTokens(buildSystemPrompt(summary)) + TOOL_DEFS_OVERHEAD
    for (const m of recent) {
      if (m.role !== 'user' && m.role !== 'assistant') continue
      const content = m.role === 'assistant' ? contentForModel(m.content) : m.content
      tokens += estimateTokens(content) + (m.images?.length ?? 0) * IMAGE_TOKENS + 6
    }
    return { tokens, limit: contextLimit, ratio: Math.min(1, tokens / contextLimit) }
  }, [messages, buildSystemPrompt, contextLimit])

  const canCompact = useMemo(() => {
    const { recent } = splitAtLastSummary(messages)
    return recent.filter((m) => m.role === 'user' || m.role === 'assistant').length >= 2
  }, [messages])

  const beginStreamState = (target: { noteId: number; convId: number }) => {
    skipPersistRef.current = false
    streamTargetRef.current = target
    setIsStreamingActive(true)
    setStreamingSegments([])
    streamingSegmentsRef.current = []
    lastSegmentWasToolRef.current = false
    thinkingStartRef.current = null
    userStoppedRef.current = false
    pendingTextRef.current = ''
    streamTextRef.current = ''
  }

  // 发送前自动压缩：预计超阈值先压缩历史再重建请求。
  // 返回要发送的消息；用户中止时返回 null（调用方负责取消本次发送）；压缩失败按原上下文发送
  const autoCompactBeforeSend = async (
    aiMessages: AIMessage[],
    history: ChatMessage[],
    rebuild: (fresh: ChatMessage[]) => AIMessage[],
  ): Promise<AIMessage[] | null> => {
    if (estimateMessagesTokens(aiMessages) + TOOL_DEFS_OVERHEAD <= contextLimitRef.current * AUTO_COMPACT_RATIO) {
      return aiMessages
    }
    setStatusText('上下文接近上限，自动压缩中…')
    compactPhaseRef.current = true
    try {
      const fresh = await runCompaction(history)
      return fresh ? rebuild(fresh) : aiMessages
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return null
      console.error('自动压缩失败，按原上下文发送:', e)
      return aiMessages
    } finally {
      compactPhaseRef.current = false
      setStatusText(null)
    }
  }

  // Actions（返回 false = 本次发送被取消/拒绝，调用方可据此还原输入区）
  const sendMessage = useCallback(async (content: string, images?: string[]): Promise<boolean> => {
    const trimmedContent = content.trim()
    // 允许只发图片；手动压缩进行中不发（历史即将变化）
    if ((!trimmedContent && (!images || images.length === 0)) || isStreaming || isCompacting || !noteId || !activeConversationId) return false

    const msgImages = images || []

    pendingUserMessageRef.current = trimmedContent
    pendingImagesRef.current = msgImages

    setPendingUserMessage(trimmedContent)
    setPendingImages(msgImages)
    beginStreamState({ noteId, convId: activeConversationId })

    const aiMessages = await autoCompactBeforeSend(
      buildAIMessages(trimmedContent, msgImages),
      messages,
      (fresh) => buildAIMessages(trimmedContent, msgImages, fresh),
    )
    // 压缩阶段被停止（AbortError 或压缩完成后的间隙点了停止）：取消发送，文字还回输入框
    if (aiMessages === null || userStoppedRef.current || skipPersistRef.current) {
      cleanupStreamState()
      setInput((cur) => cur || trimmedContent)
      return false
    }
    await startStreamWithTools(aiMessages, buildToolContext())
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, activeConversationId, isStreaming, isCompacting, messages, startStreamWithTools, buildAIMessages, buildToolContext, runCompaction])

  const handleSend = async () => {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    const sent = await sendMessage(content)
    if (!sent) setInput((cur) => cur || content)
  }

  const handleEdit = useCallback(async (id: number, newContent: string) => {
    if (!noteId || !activeConversationId || isStreaming || isStreamingActive || isCompacting) return

    const currentMessages = await chatOperations.getByConversationId(activeConversationId)
    const editedMessage = currentMessages.find(m => m.id === id)
    if (editedMessage) {
      await chatOperations.deleteAfter(noteId, editedMessage.timestamp, activeConversationId)
    }

    await chatOperations.update(id, newContent)

    const freshMessages = (await refreshMessages()) || []
    // 排除当前编辑的消息本身（它将作为新的用户消息发送）
    const historyBeforeEdit = freshMessages.filter(m => m.id !== id)

    setIsRetryMode(true)
    beginStreamState({ noteId, convId: activeConversationId })

    const aiMessages = await autoCompactBeforeSend(
      buildAIMessages(newContent, undefined, historyBeforeEdit),
      historyBeforeEdit,
      (fresh) => buildAIMessages(newContent, undefined, fresh),
    )
    if (aiMessages === null || userStoppedRef.current || skipPersistRef.current) {
      // 压缩阶段被停止：用户消息已在库中，直接收尾（可再点重试）
      cleanupStreamState()
      return
    }
    await startStreamWithTools(aiMessages, buildToolContext())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, activeConversationId, isStreaming, isStreamingActive, isCompacting, startStreamWithTools, buildAIMessages, buildToolContext, refreshMessages])

  const handleDelete = useCallback(async (id: number) => {
    // 流式/压缩中删除会让摘要或落库引用到已删内容
    if (isStreaming || isStreamingActive || isCompacting) return
    await chatOperations.delete(id)
    await refreshMessages()
  }, [isStreaming, isStreamingActive, isCompacting, refreshMessages])

  // 重新生成：向上找最近的 user 消息，删除它之后的全部消息（出错时会有
  // 「半截回复 + 错误」等多条 assistant 行，只删被点的那条会留下脏历史）
  const handleRetry = useCallback(async (message: ChatMessage) => {
    if (!noteId || !messages || !activeConversationId || isStreaming || isStreamingActive || isCompacting) return

    const messageIndex = messages.findIndex((m) => m.id === message.id)
    if (messageIndex < 0) return
    let userMessage: ChatMessage | null = null
    for (let i = messageIndex; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i]
        break
      }
    }
    if (!userMessage) return

    await chatOperations.deleteAfter(noteId, userMessage.timestamp, activeConversationId)

    const freshMessages = (await refreshMessages()) || []
    // 历史 = user 消息之前的内容，排除该 user 消息本身（它将重新发送）
    const historyBeforeRetry = freshMessages.filter(m => m.id !== userMessage.id)

    setIsRetryMode(true)
    beginStreamState({ noteId, convId: activeConversationId })

    const aiMessages = await autoCompactBeforeSend(
      buildAIMessages(userMessage.content, userMessage.images, historyBeforeRetry),
      historyBeforeRetry,
      (fresh) => buildAIMessages(userMessage.content, userMessage.images, fresh),
    )
    if (aiMessages === null || userStoppedRef.current || skipPersistRef.current) {
      cleanupStreamState()
      return
    }
    await startStreamWithTools(aiMessages, buildToolContext())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, activeConversationId, isStreaming, isStreamingActive, isCompacting, messages, startStreamWithTools, buildAIMessages, buildToolContext, refreshMessages])

  const handleClear = useCallback(async () => {
    // 进行中的压缩一并中止（否则摘要在清空后落库复活）
    compactAbortRef.current?.abort()
    if (isStreaming || isStreamingActive) {
      // 用户意图是清掉一切：流式回调的落库必须跳过，否则与 DELETE 竞态后消息复活
      skipPersistRef.current = true
      stopStream()
    }
    cleanupStreamState()
    if (activeConversationId) {
      await chatOperations.clearByConversationId(activeConversationId)
    }
    setMessages([])
  }, [isStreaming, isStreamingActive, activeConversationId, stopStream])

  // 中断进行中的流/压缩，把已生成内容存回流所属的对话（切换对话与切换笔记共用同一语义）
  const interruptStreamAndSavePartial = useCallback(async () => {
    // 进行中的压缩即刻中止（摘要落库会写错对话/在删除后复活）
    compactAbortRef.current?.abort()
    if (!(isStreaming || isStreamingActive)) return
    // 回调落库跳过（活引用会在渲染后指向新目标，异步落库会写错地方），已生成内容直接保存
    skipPersistRef.current = true
    userStoppedRef.current = true
    stopStream()
    flushPendingText()
    closeOpenThinking()
    const target = streamTargetRef.current
    const userMsg = pendingUserMessageRef.current
    const userImages = pendingImagesRef.current
    const isRetry = isRetryModeRef.current
    const inCompactPhase = compactPhaseRef.current
    const segs = [...streamingSegmentsRef.current]
    cleanupStreamState()
    // 自动压缩阶段请求还没发出：不把用户消息落库成「已发送」的假象（发送方会还原输入）
    if (!target || inCompactPhase) return
    try {
      if (!isRetry && userMsg) {
        await chatOperations.add(target.noteId, 'user', userMsg, target.convId, userImages.length > 0 ? userImages : undefined)
      }
      if (segs.length > 0) {
        await chatOperations.add(target.noteId, 'assistant', JSON.stringify({ parts: segs, stopped: true } satisfies MessageParts), target.convId)
      }
    } catch (e) {
      console.error('中断时保存未完成消息失败:', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, isStreamingActive, stopStream])

  // 切换笔记：进行中的流/压缩属于旧笔记，同样中断并存回原对话
  const prevNoteIdRef = useRef(noteId)
  useEffect(() => {
    if (prevNoteIdRef.current === noteId) return
    prevNoteIdRef.current = noteId
    interruptStreamAndSavePartial()
  }, [noteId, interruptStreamAndSavePartial])

  // 对话管理
  const createConversation = useCallback(async (title?: string) => {
    if (!noteId) return
    compactAbortRef.current?.abort()
    const convTitle = title || `对话 ${conversations.length + 1}`
    const newId = await conversationOperations.create(noteId, convTitle)
    setActiveConversationId(newId)
    await refreshConversations()
  }, [noteId, conversations.length, refreshConversations])

  const switchConversation = useCallback(async (conversationId: number) => {
    await interruptStreamAndSavePartial()
    setActiveConversationId(conversationId)
  }, [interruptStreamAndSavePartial])

  const deleteConversation = useCallback(async (conversationId: number) => {
    compactAbortRef.current?.abort()
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
    // 上下文管理
    statusText,
    isCompacting,
    contextUsage,
    canCompact,
    handleCompact,
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
    handleStop,
  }
}
