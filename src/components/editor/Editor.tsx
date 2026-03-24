import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlock from '@tiptap/extension-code-block'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef, useCallback, useState } from 'react'
import { CodeBlockComponent } from './CodeBlockComponent'
import { ResizableImage } from './ResizableImage'
import { AIReviewToolbar } from '../ai/AIReviewToolbar'
import { SlashCommand } from './SlashCommand'
import { useEditorAI, useSlashCommand } from '../../hooks'
import { useAutoTitle } from '../../hooks/useAutoTitle'
import { formatDateTime, formatTime, isSameDay } from '../../lib/utils'
import Link from '@tiptap/extension-link'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { readFile } from '@tauri-apps/plugin-fs'
import { EditorHeader } from './EditorHeader'
import { AIBubbleMenu } from '../ai/AIBubbleMenu'
import { AIInlinePrompt } from '../ai/AIInlinePrompt'
import { AIHighlight } from '../ai/AIHighlightMark'

interface EditorProps {
  title: string
  content: string
  tags?: string[]
  isEditing: boolean
  createdAt: Date | number
  updatedAt: Date | number
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onTagsChange?: (tags: string[]) => void
  contentToInsert?: string | null // 要插入的内容
  onContentInserted?: () => void // 插入完成后的回调
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void // 编辑器就绪回调
}

export function Editor({
  title,
  content,
  tags: _tags = [],
  isEditing,
  createdAt,
  updatedAt,
  onTitleChange,
  onContentChange,
  onTagsChange,
  contentToInsert,
  onContentInserted,
  onEditorReady,
}: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null)

  // 使用 ref 存储最新的 content，避免闭包问题
  const contentRef = useRef(content)
  contentRef.current = content

  // 用于跟踪用户输入产生的最新内容，避免不必要的 setContent 调用
  const lastEmittedContentRef = useRef<string | null>(null)

  // 自动标题和标签
  const { isGenerating: isGeneratingMeta, generateTitleAndTags } = useAutoTitle()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlock.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            language: {
              default: 'plaintext',
              parseHTML: (element) =>
                element.getAttribute('data-language') || 'plaintext',
              renderHTML: (attributes) => ({
                'data-language': attributes.language,
              }),
            },
          }
        },
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent)
        },
      }),
      Placeholder.configure({
        placeholder: '开始写作...',
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: null,
              parseHTML: (element) => element.getAttribute('width'),
              renderHTML: (attributes) => {
                if (!attributes.width) return {}
                return { width: attributes.width }
              },
            },
          }
        },
        addNodeView() {
          return ReactNodeViewRenderer(ResizableImage)
        },
      }).configure({
        inline: false,
        allowBase64: true,
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'cursor-text text-indigo-600 dark:text-indigo-400 underline underline-offset-4 transition-colors hover:text-indigo-500',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      AIHighlight,
    ],
    content: content,
    editable: true,
    onCreate: ({ editor }) => {
      const latestContent = contentRef.current
      if (latestContent) {
        editor.commands.setContent(latestContent, { emitUpdate: false })
      }
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-slate dark:prose-invert prose-lg max-w-none focus:outline-none min-h-[300px]',
      },
      handleDOMEvents: {
        click: (_view, event) => {
          const { target } = event
          if (target instanceof HTMLAnchorElement && (event.ctrlKey || event.metaKey)) {
            const href = target.getAttribute('href')
            if (href) {
              event.preventDefault()
              openUrl(href)
              return true
            }
          }
          return false
        },
      },
    },
  })

  // 通知父组件编辑器就绪
  useEffect(() => {
    onEditorReady?.(editor)
  }, [editor, onEditorReady])

  const {
    diffState,
    showError,
    skipContentSyncRef,
    handleAIAction,
    handleAccept,
    handleDiscard,
    startAIFromSlashCommand,
  } = useEditorAI({
    editor,
    editorContainerRef,
    onContentChange,
    title,
  })

  // 包装斜杠命令回调，拦截 show-inline-prompt
  const handleSlashAction = useCallback((action: string, templateType?: string) => {
    if (action === 'show-inline-prompt') {
      if (!editor || !editorContainerRef.current) return
      const { from, to } = editor.state.selection
      const coords = editor.view.coordsAtPos(from)
      const containerRect = editorContainerRef.current.getBoundingClientRect()
      setInlineHasSelection(from !== to)
      setInlinePromptPos({
        top: coords.bottom - containerRect.top + 4,
        left: Math.max(0, coords.left - containerRect.left),
      })
      return
    }
    startAIFromSlashCommand(action, templateType)
  }, [editor, editorContainerRef, startAIFromSlashCommand])

  const { slashMenuPos, slashCommands, closeSlashMenu } = useSlashCommand({
    editor,
    editorContainerRef,
    onAIAction: handleSlashAction,
    diffStateActive: diffState.isActive,
  })

  // Ctrl+K 内联提问
  const [inlinePromptPos, setInlinePromptPos] = useState<{ top: number; left: number } | null>(null)
  const [inlineHasSelection, setInlineHasSelection] = useState(false)

  useEffect(() => {
    if (!editor || !editorContainerRef.current) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        if (diffState.isActive) return

        const { from, to } = editor.state.selection
        const coords = editor.view.coordsAtPos(from)
        const containerRect = editorContainerRef.current!.getBoundingClientRect()

        setInlineHasSelection(from !== to)
        setInlinePromptPos({
          top: coords.bottom - containerRect.top + 4,
          left: Math.max(0, coords.left - containerRect.left),
        })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editor, editorContainerRef, diffState.isActive])

  // Ctrl 按住时链接显示手型光标
  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') el.classList.add('ctrl-held')
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') el.classList.remove('ctrl-held')
    }
    const onBlur = () => el.classList.remove('ctrl-held')

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      el.classList.remove('ctrl-held')
    }
  }, [editor])

  // Tauri 拖拽图片文件到编辑器
  useEffect(() => {
    if (!editor) return

    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']
    let unlisten: (() => void) | undefined

    getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths
        for (const filePath of paths) {
          const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
          if (!imageExts.includes(ext)) continue

          try {
            const data = await readFile(filePath)
            const mimeType = ext === '.png' ? 'image/png'
              : ext === '.svg' ? 'image/svg+xml'
              : ext === '.gif' ? 'image/gif'
              : ext === '.webp' ? 'image/webp'
              : ext === '.bmp' ? 'image/bmp'
              : 'image/jpeg'
            const base64 = btoa(
              Array.from(data).map(b => String.fromCharCode(b)).join('')
            )
            editor.chain().focus().setImage({ src: `data:${mimeType};base64,${base64}` }).run()
          } catch (err) {
            console.error('拖拽图片插入失败:', err)
          }
        }
      }
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [editor])

  // Handle editor updates
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      if (!diffState.isActive) {
        const newContent = editor.storage.markdown.getMarkdown()
        lastEmittedContentRef.current = newContent
        onContentChange(newContent)
      }
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, diffState.isActive, onContentChange])

  // 当 AI diff 状态变化时更新编辑器可编辑状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(!diffState.isActive)
    }
  }, [editor, diffState.isActive])

  // 当 content prop 变化时更新编辑器内容
  useEffect(() => {
    if (skipContentSyncRef.current) return
    
    if (content === lastEmittedContentRef.current) {
      lastEmittedContentRef.current = null
      return
    }

    if (editor && !editor.isDestroyed && content && !diffState.isActive) {
      const currentMarkdown = editor.storage.markdown.getMarkdown()
      if (content !== currentMarkdown) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
    }
  }, [content, editor, diffState.isActive])

  // 处理从侧栏插入内容
  useEffect(() => {
    if (!contentToInsert || !editor || editor.isDestroyed) return

    // 移动光标到文档末尾
    editor.commands.focus('end')

    // 插入两个换行符和内容
    editor.commands.insertContent('\n\n' + contentToInsert)

    // 更新内容（以 Markdown 格式保存）
    const newContent = editor.storage.markdown.getMarkdown()
    onContentChange(newContent)

    // 通知插入完成
    onContentInserted?.()
  }, [contentToInsert, editor, onContentChange, onContentInserted])

  // 手动生成标题和标签
  const handleGenerateMeta = useCallback(async () => {
    const contentText = editor?.getText() || ''

    if (contentText.length < 20 || isGeneratingMeta) {
      // 这里我们可能需要一个方式来显示错误，但 showError 是从 hook 来的
      // 暂时忽略，或者我们可以扩展 hook 来允许外部设置 error
      return
    }

    const result = await generateTitleAndTags(contentText, title)
    if (result.title) {
      onTitleChange(result.title)
    }
    if (result.tags && onTagsChange) {
      onTagsChange(result.tags)
    }
  }, [title, editor, isGeneratingMeta, generateTitleAndTags, onTitleChange, onTagsChange])


  // 如果编辑器还没准备好，显示加载状态
  if (!editor) {
    return (
      <div className="flex-1 h-full overflow-y-auto">
        <div className="px-12 py-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {title || '无标题'}
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mt-2 mb-4">
            <span>创建于 {formatDateTime(createdAt)}</span>
            <span>•</span>
            <span>
              最后修改于{' '}
              {isSameDay(createdAt, updatedAt)
                ? formatTime(updatedAt)
                : formatDateTime(updatedAt)}
            </span>
          </div>
          <div className="mt-6 prose prose-slate dark:prose-invert prose-lg whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="px-12 py-8">
        <EditorHeader
          title={title}
          isEditing={isEditing}
          createdAt={createdAt}
          updatedAt={updatedAt}
          onTitleChange={onTitleChange}
          onGenerateMeta={handleGenerateMeta}
          isGeneratingMeta={isGeneratingMeta}
        />

        {/* Tiptap 编辑器 */}
        <div
          ref={editorContainerRef}
          className="mt-6 relative"
        >
          <AIBubbleMenu editor={editor} onAIAction={handleAIAction} />
          <EditorContent editor={editor} />

          {/* 斜杠命令菜单 */}
          {slashMenuPos && (
            <SlashCommand
              editor={editor}
              items={slashCommands}
              position={slashMenuPos}
              onSelect={(item) => item.action(editor)}
              onClose={closeSlashMenu}
            />
          )}

          {/* Ctrl+K 内联提问 */}
          {inlinePromptPos && !diffState.isActive && (
            <AIInlinePrompt
              position={inlinePromptPos}
              hasSelection={inlineHasSelection}
              onSubmit={(prompt) => {
                handleAIAction('custom', prompt)
                setInlinePromptPos(null)
              }}
              onClose={() => setInlinePromptPos(null)}
            />
          )}

          {/* AI 生成中/审查工具栏 - 固定在底部 */}
          {diffState.isActive && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
              <AIReviewToolbar
                isStreaming={diffState.isStreaming}
                onAccept={handleAccept}
                onDiscard={handleDiscard}
              />
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {showError && (
          <div className="fixed bottom-4 right-4 px-4 py-2 bg-red-50/90 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl shadow-lg border border-red-200/50 dark:border-red-800/50 backdrop-blur-sm">
            {showError}
          </div>
        )}
      </div>

    </div>
  )
}
