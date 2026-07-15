import { useState, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { useAIStream, type AIAction, type AIContext, type TemplateType } from './useAIStream'

export interface AIDiffState {
  isActive: boolean
  originalText: string
  generatedText: string
  isStreaming: boolean
  action: AIAction | null
  customPrompt?: string
}

interface UseEditorAIProps {
  editor: Editor | null
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  onContentChange: (content: string) => void
  title: string
}

// 编辑器内联 AI：Cursor 式就地 diff。
// 选中替换：原文标红删除线保留，AI 新文本紧随其后绿色流式生长；
// 无选中（续写/提问/模板）：在光标处直接流式插入，不再跳到文档末尾。
// 接受 = 删原文+去绿标；放弃 = 删新文+恢复原文样式。全程按范围操作，位置自动追踪。
export function useEditorAI({ editor, editorContainerRef, onContentChange, title }: UseEditorAIProps) {
  const [diffState, setDiffState] = useState<AIDiffState>({
    isActive: false,
    originalText: '',
    generatedText: '',
    isStreaming: false,
    action: null,
  })

  const [showError, setShowError] = useState<string | null>(null)
  // Review 工具条的锚点（编辑器容器相对坐标，跟随生成末尾）
  const [reviewAnchor, setReviewAnchor] = useState<{ top: number; left: number } | null>(null)

  // 生成/原文范围（编辑器在 diff 期间锁定编辑，只有我们自己的事务会动文档，数值位置可靠）
  const genRangeRef = useRef<{ from: number; to: number } | null>(null)
  const oldRangeRef = useRef<{ from: number; to: number } | null>(null)
  // 重试/追加指令用：记住这次请求
  const lastRequestRef = useRef<{
    action: AIAction
    text: string
    customPrompt?: string
    templateType?: TemplateType
  } | null>(null)

  // 防止 content 同步覆盖刚接受/放弃的内容
  const skipContentSyncRef = useRef(false)

  const resetDiffState = useCallback(() => {
    setDiffState({
      isActive: false,
      originalText: '',
      generatedText: '',
      isStreaming: false,
      action: null,
    })
    setReviewAnchor(null)
    genRangeRef.current = null
    oldRangeRef.current = null
  }, [])

  const flashError = useCallback((msg: string) => {
    setShowError(msg)
    setTimeout(() => setShowError(null), 3000)
  }, [])

  // 把工具条锚点更新到生成末尾的下一行（容器相对坐标）
  const updateAnchor = useCallback((pos: number) => {
    if (!editor || !editorContainerRef.current) return
    try {
      const coords = editor.view.coordsAtPos(pos)
      const rect = editorContainerRef.current.getBoundingClientRect()
      setReviewAnchor({
        top: coords.bottom - rect.top + 8,
        left: Math.max(0, Math.min(coords.left - rect.left, rect.width - 340)),
      })
    } catch { /* 位置暂不可解析（事务间隙），下个 chunk 再更 */ }
  }, [editor, editorContainerRef])

  // 让生成末尾保持在视口内
  const keepInView = useCallback((pos: number) => {
    if (!editor) return
    try {
      const dom = editor.view.domAtPos(pos)
      const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement
      el?.scrollIntoView({ block: 'nearest' })
    } catch { /* ignore */ }
  }, [editor])

  // 跨 chunk 悬挂的换行数（chunk 可能在 '\n\n' 中间断开）
  const pendingNewlinesRef = useRef(0)

  // 在 genRange.to 处插入一段流式文本，带 aiHighlight 标记。
  // 换行语义：开头的换行丢弃（避免原文与新文本之间空一行）、'\n\n' 分段、单 '\n' 硬换行、
  // 尾部换行悬挂到下一 chunk（结束时自然丢弃，不留尾部空行）。
  // 必须用显式 marks 建文本节点：tr.insertText 会继承插入点的 marks——
  // 插入点紧贴红标原文，生成文本会悄悄带上 aiOld，接受后红标残留并序列化进笔记
  const insertChunk = useCallback((chunk: string) => {
    if (!editor || !genRangeRef.current) return
    const range = genRangeRef.current

    let text = '\n'.repeat(pendingNewlinesRef.current) + chunk
    pendingNewlinesRef.current = 0
    const trailing = text.match(/\n+$/)
    if (trailing) {
      pendingNewlinesRef.current = trailing[0].length
      text = text.slice(0, -trailing[0].length)
    }
    if (range.to === range.from) text = text.replace(/^\n+/, '')
    if (!text) return

    editor
      .chain()
      .command(({ tr, state }) => {
        const markType = state.schema.marks.aiHighlight
        const hardBreak = state.schema.nodes.hardBreak
        const marks = markType ? [markType.create()] : undefined
        // split 保留分隔符：偶数下标是文本，奇数下标是连续换行串
        const tokens = text.split(/(\n+)/)
        for (const token of tokens) {
          if (!token) continue
          if (token[0] === '\n') {
            if (token.length === 1 && hardBreak) {
              tr.insert(range.to, hardBreak.create())
              range.to += 1
            } else {
              // '\n\n'（及以上）= 新段落；split 产生两个边界 token
              tr.split(range.to)
              range.to += 2
            }
          } else {
            tr.insert(range.to, state.schema.text(token, marks))
            range.to += token.length
          }
        }
        return true
      })
      .run()
    updateAnchor(range.to)
    keepInView(range.to)
  }, [editor, updateAnchor, keepInView])

  const { isStreaming, startStream, stopStream } = useAIStream({
    onChunk: (chunk) => {
      insertChunk(chunk)
      setDiffState(prev => ({ ...prev, generatedText: prev.generatedText + chunk }))
    },
    onFinish: (fullText) => {
      setDiffState(prev => ({ ...prev, generatedText: fullText, isStreaming: false }))
    },
    onError: (error) => {
      flashError(error)
      // 删已生成内容 + 恢复原文样式（等价放弃）
      discardChanges()
    },
  })

  // 获取光标前上下文
  const getContextText = useCallback(() => {
    if (!editor) return ''
    const { from } = editor.state.selection
    return editor.state.doc.textBetween(0, from, ' ').slice(-500)
  }, [editor])

  const buildAIContext = useCallback((): AIContext => ({
    noteTitle: title,
    surroundingText: getContextText().slice(-200),
  }), [title, getContextText])

  // 生成内核：标记原文（可选）→ 在锚点流式生成
  const beginGeneration = useCallback(async (opts: {
    action: AIAction
    text: string
    customPrompt?: string
    templateType?: TemplateType
    // 替换模式的原文范围；无则为插入模式
    oldRange?: { from: number; to: number } | null
    insertAt: number
  }) => {
    if (!editor) return
    const { action, text, customPrompt, templateType, oldRange, insertAt } = opts

    if (oldRange) {
      // 原文标红删除线保留（不删！），接受时才删
      editor
        .chain()
        .command(({ tr, state }) => {
          const markType = state.schema.marks.aiOld
          if (markType) tr.addMark(oldRange.from, oldRange.to, markType.create())
          return true
        })
        .run()
      oldRangeRef.current = { ...oldRange }
    } else {
      oldRangeRef.current = null
    }
    genRangeRef.current = { from: insertAt, to: insertAt }
    pendingNewlinesRef.current = 0
    lastRequestRef.current = { action, text, customPrompt, templateType }

    setDiffState({
      isActive: true,
      originalText: oldRange ? editor.state.doc.textBetween(oldRange.from, oldRange.to, '\n') : '',
      generatedText: '',
      isStreaming: true,
      action,
      customPrompt,
    })
    updateAnchor(insertAt)

    await startStream(action, text, customPrompt, buildAIContext(), templateType)
  }, [editor, startStream, buildAIContext, updateAnchor])

  // 入口：气泡菜单 / Ctrl+J（有选中=替换，无选中=光标处生成）
  const handleAIAction = useCallback(async (action: AIAction, customPrompt?: string) => {
    if (!editor || diffState.isActive) return

    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '\n')

    if (selectedText.trim()) {
      // 替换模式：原文 [from,to] 标红，新文本从 to 开始生长
      await beginGeneration({
        action,
        text: selectedText,
        customPrompt,
        oldRange: { from, to },
        insertAt: to,
      })
      return
    }

    // 无选中：续写/自定义在光标处生成（不再跳文末）
    if (action === 'continue' || (action === 'custom' && customPrompt)) {
      const context = getContextText()
      if (action === 'continue' && !context.trim()) {
        flashError('请先输入一些内容')
        return
      }
      await beginGeneration({
        action,
        text: context,
        customPrompt,
        oldRange: null,
        insertAt: from,
      })
    }
  }, [editor, diffState.isActive, beginGeneration, getContextText, flashError])

  // 接受：删原文、去掉新文本的绿标
  const handleAccept = useCallback(() => {
    if (!editor || !genRangeRef.current) return
    const gen = genRangeRef.current
    const old = oldRangeRef.current

    skipContentSyncRef.current = true
    editor
      .chain()
      .command(({ tr, state }) => {
        const hl = state.schema.marks.aiHighlight
        const aiOld = state.schema.marks.aiOld
        if (hl) tr.removeMark(gen.from, gen.to, hl)
        // 保险带：生成范围若沾上 aiOld（任何来源）一并清掉，绝不让 diff 标记漏进正文
        if (aiOld) tr.removeMark(gen.from, gen.to, aiOld)
        // 原文范围在生成范围之前，mark 操作不移位，删除放最后
        if (old) tr.delete(old.from, old.to)
        return true
      })
      .run()
    editor.setEditable(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onContentChange((editor.storage as any).markdown.getMarkdown())
    resetDiffState()
    setTimeout(() => { skipContentSyncRef.current = false }, 100)
  }, [editor, onContentChange, resetDiffState])

  // 放弃内核：删新文本、恢复原文样式（onError 也走这里）
  const discardChanges = useCallback(() => {
    if (!editor) return
    const gen = genRangeRef.current
    const old = oldRangeRef.current

    skipContentSyncRef.current = true
    editor
      .chain()
      .command(({ tr, state }) => {
        if (gen && gen.to > gen.from) tr.delete(gen.from, gen.to)
        // gen 范围在 old 之后，删除不影响 old 位置
        const markType = state.schema.marks.aiOld
        if (old && markType) tr.removeMark(old.from, old.to, markType)
        return true
      })
      .run()
    editor.setEditable(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onContentChange((editor.storage as any).markdown.getMarkdown())
    resetDiffState()
    setTimeout(() => { skipContentSyncRef.current = false }, 100)
  }, [editor, onContentChange, resetDiffState])

  const handleDiscard = useCallback(() => {
    if (isStreaming) stopStream()
    discardChanges()
  }, [isStreaming, stopStream, discardChanges])

  // 重试：清掉已生成内容（原文红标保留），用同样请求重新生成
  const handleRetry = useCallback(async () => {
    if (!editor || !genRangeRef.current || !lastRequestRef.current) return
    if (isStreaming) stopStream()
    const gen = genRangeRef.current
    if (gen.to > gen.from) {
      editor.chain().command(({ tr }) => { tr.delete(gen.from, gen.to); return true }).run()
      gen.to = gen.from
    }
    const req = lastRequestRef.current
    pendingNewlinesRef.current = 0
    setDiffState(prev => ({ ...prev, generatedText: '', isStreaming: true }))
    await startStream(req.action, req.text, req.customPrompt, buildAIContext(), req.templateType)
  }, [editor, isStreaming, stopStream, startStream, buildAIContext])

  // 追加指令：以当前生成结果为输入再改一轮（Cursor 的 follow-up）
  const handleFollowUp = useCallback(async (instruction: string) => {
    if (!editor || !genRangeRef.current || !diffState.generatedText || isStreaming) return
    const gen = genRangeRef.current
    const currentText = diffState.generatedText
    if (gen.to > gen.from) {
      editor.chain().command(({ tr }) => { tr.delete(gen.from, gen.to); return true }).run()
      gen.to = gen.from
    }
    lastRequestRef.current = { action: 'custom', text: currentText, customPrompt: instruction }
    pendingNewlinesRef.current = 0
    setDiffState(prev => ({ ...prev, generatedText: '', isStreaming: true, customPrompt: instruction }))
    await startStream('custom', currentText, instruction, buildAIContext())
  }, [editor, diffState.generatedText, isStreaming, startStream, buildAIContext])

  // 斜杠命令入口：在当前光标处生成（不再跳文末）
  const startAIFromSlashCommand = useCallback((action: string, templateType?: string) => {
    if (!editor || diffState.isActive) return
    const contextText = getContextText()
    const insertAt = editor.state.selection.from

    if (action === 'continue') {
      void beginGeneration({ action: 'continue', text: contextText, oldRange: null, insertAt })
    } else if (action === 'custom' && templateType) {
      void beginGeneration({ action: 'custom', text: contextText, customPrompt: templateType, oldRange: null, insertAt })
    } else if (action === 'template' && templateType) {
      void beginGeneration({ action: 'template', text: contextText, templateType: templateType as TemplateType, oldRange: null, insertAt })
    }
  }, [editor, diffState.isActive, getContextText, beginGeneration])

  return {
    diffState,
    showError,
    reviewAnchor,
    skipContentSyncRef,
    handleAIAction,
    handleAccept,
    handleDiscard,
    handleRetry,
    handleFollowUp,
    startAIFromSlashCommand,
  }
}
