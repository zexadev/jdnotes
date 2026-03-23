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

export function useEditorAI({ editor, editorContainerRef, onContentChange, title }: UseEditorAIProps) {
  // AI Diff 状态
  const [diffState, setDiffState] = useState<AIDiffState>({
    isActive: false,
    originalText: '',
    generatedText: '',
    isStreaming: false,
    action: null,
  })

  const [showError, setShowError] = useState<string | null>(null)

  // 记录 AI 内容插入的起始位置
  const aiInsertPosRef = useRef<number>(0)

  // 防止 content 同步覆盖刚接受/放弃的内容
  const skipContentSyncRef = useRef(false)

  // 重置 diff 状态
  const resetDiffState = useCallback(() => {
    setDiffState({
      isActive: false,
      originalText: '',
      generatedText: '',
      isStreaming: false,
      action: null,
    })
  }, [])

  // AI Stream hook
  const { isStreaming, startStream, stopStream } = useAIStream({
    onChunk: (chunk) => {
      if (!editor) return

      // 直接在编辑器中追加内容，带 aiHighlight mark
      editor.chain()
        .focus()
        .command(({ tr, state }) => {
          // 插入到最后一个段落内部（end - 1），而不是文档末尾（end）
          const insertPos = state.doc.content.size - 1
          const markType = state.schema.marks.aiHighlight
          if (markType) {
            const mark = markType.create()
            tr.insertText(chunk, insertPos)
            tr.addMark(insertPos, insertPos + chunk.length, mark)
          } else {
            tr.insertText(chunk, insertPos)
          }
          return true
        })
        .run()

      setDiffState(prev => ({
        ...prev,
        generatedText: prev.generatedText + chunk,
      }))
    },
    onFinish: (fullText) => {
      setDiffState(prev => ({
        ...prev,
        generatedText: fullText,
        isStreaming: false,
      }))
    },
    onError: (error) => {
      setShowError(error)
      setTimeout(() => setShowError(null), 3000)
      // 删除已插入的 AI 内容，恢复原始文本
      if (editor) {
        removeAIHighlightContent(editor)
        if (diffState.originalText) {
          editor.chain().focus().insertContent(diffState.originalText).run()
        }
      }
      resetDiffState()
    },
  })

  // 删除编辑器中所有带 aiHighlight mark 的内容
  const removeAIHighlightContent = useCallback((ed: Editor) => {
    const { state } = ed
    const markType = state.schema.marks.aiHighlight
    if (!markType) return

    const ranges: { from: number; to: number }[] = []
    state.doc.descendants((node, pos) => {
      if (node.isText) {
        node.marks.forEach(mark => {
          if (mark.type === markType) {
            ranges.push({ from: pos, to: pos + node.nodeSize })
          }
        })
      }
    })

    // 从后往前删除，避免位置偏移
    if (ranges.length > 0) {
      ed.chain()
        .command(({ tr }) => {
          for (let i = ranges.length - 1; i >= 0; i--) {
            tr.delete(ranges[i].from, ranges[i].to)
          }
          return true
        })
        .run()
    }
  }, [])

  // 移除 aiHighlight mark 但保留内容
  const clearAIHighlightMark = useCallback((ed: Editor) => {
    const { state } = ed
    const markType = state.schema.marks.aiHighlight
    if (!markType) return

    ed.chain()
      .command(({ tr }) => {
        tr.removeMark(0, state.doc.content.size, markType)
        return true
      })
      .run()
  }, [])

  // 获取上下文
  const getContextText = useCallback(() => {
    if (!editor) return ''
    const { from } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(0, from, ' ')
    return textBefore.slice(-500)
  }, [editor])

  const buildAIContext = useCallback((): AIContext => ({
    noteTitle: title,
    surroundingText: getContextText().slice(-200),
  }), [title, getContextText])

  // 处理 AI 操作
  const handleAIAction = useCallback(async (action: AIAction, customPrompt?: string) => {
    if (!editor || !editorContainerRef.current) return

    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')

    let textToProcess = ''
    let originalText = ''

    if (action === 'continue') {
      // 续写模式：使用上下文
      textToProcess = getContextText()
      if (!textToProcess.trim()) {
        setShowError('请先输入一些内容')
        setTimeout(() => setShowError(null), 3000)
        return
      }
      originalText = ''

      // 光标移到文档末尾，AI 内容将从这里开始追加
      editor.commands.focus('end')
      // 插入换行
      editor.commands.insertContent('\n')
      aiInsertPosRef.current = editor.state.selection.from
    } else if (selectedText.trim()) {
      // 有选中文本：替换模式
      textToProcess = selectedText
      originalText = selectedText

      // 记录位置后删除选中文本
      aiInsertPosRef.current = from
      editor.chain().focus().deleteSelection().run()
    } else if (action === 'custom' && customPrompt) {
      // 自定义提问，无选中
      textToProcess = getContextText()
      originalText = ''

      editor.commands.focus('end')
      editor.commands.insertContent('\n')
      aiInsertPosRef.current = editor.state.selection.from
    } else {
      return
    }

    setDiffState({
      isActive: true,
      originalText,
      generatedText: '',
      isStreaming: true,
      action,
      customPrompt,
    })

    await startStream(action, textToProcess, customPrompt, buildAIContext())
  }, [editor, editorContainerRef, getContextText, startStream, buildAIContext])

  // 接受 AI 更改
  const handleAccept = useCallback(() => {
    if (!editor || !diffState.generatedText) return

    // 设置跳过同步标志
    skipContentSyncRef.current = true

    // 移除 aiHighlight mark，保留内容
    clearAIHighlightMark(editor)

    // 确保编辑器可编辑
    editor.setEditable(true)

    // 立即更新 content 状态（以 Markdown 格式保存）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newContent = (editor.storage as any).markdown.getMarkdown()
    onContentChange(newContent)

    // 重置状态
    resetDiffState()

    // 延迟重置跳过标志
    setTimeout(() => {
      skipContentSyncRef.current = false
    }, 100)
  }, [editor, diffState.generatedText, resetDiffState, onContentChange, clearAIHighlightMark])

  // 放弃 AI 更改
  const handleDiscard = useCallback(() => {
    if (isStreaming) {
      stopStream()
    }

    // 设置跳过同步标志
    skipContentSyncRef.current = true

    if (editor) {
      // 删除所有带 aiHighlight mark 的内容
      removeAIHighlightContent(editor)

      // 确保编辑器可编辑
      editor.setEditable(true)

      // 恢复原始文本
      if (diffState.originalText) {
        editor.chain().focus().insertContent(diffState.originalText).run()
      }

      // 立即更新 content 状态（以 Markdown 格式保存）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newContent = (editor.storage as any).markdown.getMarkdown()
      onContentChange(newContent)
    }

    resetDiffState()

    // 延迟重置跳过标志
    setTimeout(() => {
      skipContentSyncRef.current = false
    }, 100)
  }, [editor, diffState.originalText, isStreaming, stopStream, resetDiffState, onContentChange, removeAIHighlightContent])

  // 处理斜杠命令触发的 AI
  const startAIFromSlashCommand = useCallback((action: string, templateType?: string) => {
    if (!editor || !editorContainerRef.current) return

    const contextText = getContextText()

    // 光标移到末尾，AI 内容从这里追加
    editor.commands.focus('end')
    editor.commands.insertContent('\n')
    aiInsertPosRef.current = editor.state.selection.from

    if (action === 'continue') {
      // AI 续写
      setDiffState({
        isActive: true,
        originalText: '',
        generatedText: '',
        isStreaming: true,
        action: 'continue',
      })
      startStream('continue', contextText, undefined, buildAIContext())
    } else if (action === 'custom' && templateType) {
      // 自由提问
      setDiffState({
        isActive: true,
        originalText: '',
        generatedText: '',
        isStreaming: true,
        action: 'custom',
        customPrompt: templateType,
      })
      startStream('custom', contextText, templateType, buildAIContext())
    } else if (action === 'template' && templateType) {
      // 模板生成
      setDiffState({
        isActive: true,
        originalText: '',
        generatedText: '',
        isStreaming: true,
        action: 'template',
        customPrompt: templateType,
      })
      startStream('template', contextText, undefined, buildAIContext(), templateType as TemplateType)
    }
  }, [editor, editorContainerRef, getContextText, startStream, buildAIContext])

  return {
    diffState,
    showError,
    skipContentSyncRef,
    handleAIAction,
    handleAccept,
    handleDiscard,
    startAIFromSlashCommand,
  }
}
