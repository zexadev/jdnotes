import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlock from '@tiptap/extension-code-block'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Typography from '@tiptap/extension-typography'
import Focus from '@tiptap/extension-focus'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table'
import { TableHeader } from '@tiptap/extension-table'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef, useCallback, useState } from 'react'
import { CodeBlockComponent } from './CodeBlockComponent'
import { ResizableImage } from './ResizableImage'
import { AIReviewToolbar } from '../ai/AIReviewToolbar'
import { SlashCommand } from './SlashCommand'
import { NoteRefMenu, type NoteRefItem } from './NoteRefMenu'
import { useEditorAI, useSlashCommand, useNoteRefMenu } from '../../hooks'
import { useAutoTitle } from '../../hooks/useAutoTitle'
import { formatDateTime, formatTime, isSameDay } from '../../lib/utils'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { readFile } from '@tauri-apps/plugin-fs'
import { EditorHeader } from './EditorHeader'
import { AIBubbleMenu } from '../ai/AIBubbleMenu'
import { TableBubbleMenu } from './TableBubbleMenu'
import { AIInlinePrompt } from '../ai/AIInlinePrompt'
import { AIHighlight } from '../ai/AIHighlightMark'
import { Callout } from './CalloutBlock'
import { WikiRef } from './WikiRef'

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
  allNotes?: NoteRefItem[] // 笔记引用选择器（[[）的候选笔记
  currentNoteId?: number | null // 当前笔记 id，引用选择器里排除自身
  onOpenNoteRef?: (uuid: string) => void // 点击 note://<uuid> 引用时跳转
  onOpenNoteByTitle?: (title: string) => void // 点击字面 [[标题]] 引用时按标题跳转
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
  allNotes = [],
  currentNoteId = null,
  onOpenNoteRef,
  onOpenNoteByTitle,
}: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  // 用 ref 持有最新的跳转回调，避免 editorProps.click 闭包拿到旧引用
  const onOpenNoteRefRef = useRef(onOpenNoteRef)
  onOpenNoteRefRef.current = onOpenNoteRef
  const onOpenNoteByTitleRef = useRef(onOpenNoteByTitle)
  onOpenNoteByTitleRef.current = onOpenNoteByTitle
  // 在 editorProps.handlePaste 等回调中访问编辑器实例（定义早于 editor 变量）
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)

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
        // 放行 note: 协议，让笔记引用 note://<uuid> 不被链接消毒过滤；点击交给下方 click 处理
        link: { openOnClick: false, protocols: ['note'] },
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
        // html:true —— 复杂表格(多块单元格/合并/无表头)无法转 GFM 时序列化为 HTML 保住内容，
        // 而非 html:false 下回退成 [table] 占位符丢失内容；简单表格仍输出干净 GFM。
        html: true,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      AIHighlight,
      Callout,
      WikiRef,
      CharacterCount.configure({}),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Typography,
      Focus.configure({ className: 'has-focus', mode: 'deepest' }),
      TextStyle,
      Color,
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
          'prose prose-slate dark:prose-invert prose-lg max-w-none focus:outline-none min-h-[300px] prose-a:cursor-text prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:underline-offset-4 hover:prose-a:text-indigo-500 prose-a:transition-colors',
      },
      handleDOMEvents: {
        click: (_view, event) => {
          const { target } = event
          // 字面 [[标题]] 引用（WikiRef 装饰渲染的 span，非 anchor）：单击按标题跳转
          const wiki =
            target instanceof HTMLElement ? target.closest('[data-note-ref-title]') : null
          if (wiki) {
            event.preventDefault()
            onOpenNoteByTitleRef.current?.(wiki.getAttribute('data-note-ref-title') || '')
            return true
          }
          if (!(target instanceof HTMLAnchorElement)) return false
          const href = target.getAttribute('href')
          if (!href) return false
          // 内部笔记引用：单击直接跳转
          if (href.startsWith('note://')) {
            event.preventDefault()
            onOpenNoteRefRef.current?.(href.slice('note://'.length))
            return true
          }
          // 外部链接：Ctrl/⌘ + 单击用系统浏览器打开
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            openUrl(href)
            return true
          }
          return false
        },
      },
      // 粘贴多张图片：一次性按顺序插入，避免逐张 setImage 互相覆盖
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        const imageFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) imageFiles.push(file)
          }
        }
        if (imageFiles.length === 0) return false
        event.preventDefault()
        Promise.allSettled(
          imageFiles.map(
            (file) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(file)
              })
          )
        ).then((settled) => {
          // 用 allSettled：个别图片读取失败时仍插入其余的，而不是整批静默丢弃
          const srcs = settled
            .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
            .map((r) => r.value)
          const failed = settled.length - srcs.length
          if (failed > 0) console.error(`粘贴图片：${failed} 张读取失败已跳过`)
          if (srcs.length === 0) return
          const ed = editorRef.current
          if (!ed) return
          ed
            .chain()
            .focus()
            .insertContent(srcs.map((src) => ({ type: 'image', attrs: { src } })))
            .run()
        })
        return true
      },
    },
  })

  // 让 editorProps 回调能拿到最新的编辑器实例
  editorRef.current = editor

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

  // 笔记引用菜单（输入 [[ 触发）
  const { noteRefMenuPos, noteRefQuery, closeNoteRefMenu, insertNoteRef } = useNoteRefMenu({
    editor,
    editorContainerRef,
    enabled: !diffState.isActive,
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
    let cancelled = false

    getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop') return

      // 仅当拖放位置落在编辑器容器内时才插入
      const container = editorContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const x = event.payload.position.x / dpr
      const y = event.payload.position.y / dpr
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return
      }

      const paths = event.payload.paths
      // 先把所有图片读成 data URL，再一次性按顺序插入，避免逐张 setImage 互相覆盖
      const srcs: string[] = []
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
          srcs.push(`data:${mimeType};base64,${base64}`)
        } catch (err) {
          console.error('拖拽图片插入失败:', err)
        }
      }
      if (srcs.length > 0) {
        editor
          .chain()
          .focus()
          .insertContent(srcs.map((src) => ({ type: 'image', attrs: { src } })))
          .run()
      }
    }).then((fn) => {
      if (cancelled) {
        // 注册期间组件已卸载,立刻清理
        fn()
      } else {
        unlisten = fn
      }
    })

    return () => {
      cancelled = true
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
          <TableBubbleMenu editor={editor} />
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

          {/* 笔记引用菜单（[[ 触发） */}
          {noteRefMenuPos && (
            <NoteRefMenu
              notes={allNotes}
              query={noteRefQuery}
              currentNoteId={currentNoteId}
              position={noteRefMenuPos}
              onSelect={(note) => insertNoteRef(note.uuid!, note.title)}
              onClose={closeNoteRefMenu}
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
