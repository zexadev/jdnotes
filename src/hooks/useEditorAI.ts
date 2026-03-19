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
  
  // Ghost 面板位置（基于光标）
  const [ghostPosition, setGhostPosition] = useState<{ top: number; left: number } | null>(null)
  
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
    setGhostPosition(null)
  }, [])

  // AI Stream hook
  const { isStreaming, startStream, stopStream } = useAIStream({
    onChunk: (chunk) => {
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
      // 恢复原始文本
      if (editor && diffState.originalText) {
        editor.chain().focus().insertContent(diffState.originalText).run()
      }
      resetDiffState()
    },
  })

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
    const containerRect = editorContainerRef.current.getBoundingClientRect()

    let textToProcess = ''
    let originalText = ''

    if (action === 'continue') {
      // 续写模式：使用上下文，定位到当前行下一行
      textToProcess = getContextText()
      if (!textToProcess.trim()) {
        setShowError('请先输入一些内容')
        setTimeout(() => setShowError(null), 3000)
        return
      }
      originalText = ''

      // 获取当前行末尾位置，定位到下一行
      const coords = editor.view.coordsAtPos(from)
      setGhostPosition({
        top: coords.bottom - containerRect.top + 4, // 下一行
        left: 0, // 从行首开始
      })
    } else if (selectedText.trim()) {
      // 有选中文本：替换模式，定位到选中位置
      textToProcess = selectedText
      originalText = selectedText

      const coords = editor.view.coordsAtPos(from)
      setGhostPosition({
        top: coords.top - containerRect.top,
        left: coords.left - containerRect.left,
      })

      // 删除选中的文本
      editor.chain().focus().deleteSelection().run()
    } else if (action === 'custom' && customPrompt) {
      // 自定义提问，无选中：定位到当前行下一行
      textToProcess = getContextText()
      originalText = ''

      const coords = editor.view.coordsAtPos(from)
      setGhostPosition({
        top: coords.bottom - containerRect.top + 4,
        left: 0,
      })
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

    // 先设置编辑器为可编辑
    editor.setEditable(true)

    // 插入内容
    editor.chain().focus().insertContent(diffState.generatedText).run()

    // 立即更新 content 状态，防止被旧内容覆盖（以 Markdown 格式保存）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newContent = (editor.storage as any).markdown.getMarkdown()
    onContentChange(newContent)

    // 重置状态
    resetDiffState()

    // 延迟重置跳过标志
    setTimeout(() => {
      skipContentSyncRef.current = false
    }, 100)
  }, [editor, diffState.generatedText, resetDiffState, onContentChange])

  // 放弃 AI 更改
  const handleDiscard = useCallback(() => {
    if (isStreaming) {
      stopStream()
    }

    // 设置跳过同步标志
    skipContentSyncRef.current = true

    if (editor) {
      // 先设置编辑器为可编辑
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
  }, [editor, diffState.originalText, isStreaming, stopStream, resetDiffState, onContentChange])

  // 处理斜杠命令触发的 AI
  const startAIFromSlashCommand = useCallback((action: string, templateType?: string) => {
    if (!editor || !editorContainerRef.current) return

    // 获取光标位置
    const { from } = editor.state.selection
    const coords = editor.view.coordsAtPos(from)
    const containerRect = editorContainerRef.current.getBoundingClientRect()

    // 设置 Ghost 位置
    setGhostPosition({
      top: coords.bottom - containerRect.top + 4,
      left: 0,
    })

    const contextText = getContextText()

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
    ghostPosition,
    skipContentSyncRef,
    handleAIAction,
    handleAccept,
    handleDiscard,
    startAIFromSlashCommand,
  }
}
