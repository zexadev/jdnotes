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
import { AIOld } from '../ai/AIOldMark'
import { LinkPopover, type LinkPopoverState } from './LinkPopover'
import { getMarkRange } from '@tiptap/core'
import { Callout } from './CalloutBlock'
import { WikiRef } from './WikiRef'
import { SafeHtmlBlock } from './SafeHtmlBlock'

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
              // data-language（自家 NodeView）优先；否则回退基类的 language-xxx class 解析——
              // markdown 解析出的 ```js 走的是 class，之前被覆盖后语言全部洗成 plaintext
              parseHTML: (element) => {
                const explicit = element.getAttribute('data-language')
                if (explicit) return explicit
                const cls = [...(element.firstElementChild?.classList ?? [])]
                  .find((c) => c.startsWith('language-'))
                return cls ? cls.slice('language-'.length) : 'plaintext'
              },
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
      AIOld,
      Callout,
      WikiRef,
      SafeHtmlBlock,
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
        // 内部引用用 mousedown 抢在光标落入之前跳转：否则 ProseMirror 先把光标落进引用
        // → 触发编辑态显出中括号、且跳转落空（这就是"点了不跳、反而展开成 [[..]]"的原因）
        mousedown: (_view, event) => {
          if (event.button !== 0) return false
          const { target } = event
          if (!(target instanceof HTMLElement)) return false
          // 字面 [[标题]] chip（非编辑态）→ 按标题跳转
          const wiki = target.closest('[data-note-ref-title]')
          if (wiki && !wiki.classList.contains('note-ref-wiki-editing')) {
            event.preventDefault()
            onOpenNoteByTitleRef.current?.(wiki.getAttribute('data-note-ref-title') || '')
            return true
          }
          // note://uuid 引用 → 按 uuid 跳转
          const anchor = target.closest('a')
          const href = anchor?.getAttribute('href')
          if (href && href.startsWith('note://')) {
            event.preventDefault()
            onOpenNoteRefRef.current?.(href.slice('note://'.length))
            return true
          }
          return false
        },
        // 外部链接：Ctrl/⌘ + 单击用系统浏览器打开（内部引用已在 mousedown 处理）
        click: (_view, event) => {
          const { target } = event
          if (!(target instanceof HTMLElement)) return false
          const anchor = target.closest('a')
          const href = anchor?.getAttribute('href')
          if (!href || href.startsWith('note://')) return false
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            openUrl(href)
            return true
          }
          return false
        },
      },
      // 粘贴多张图片：一次性按顺序插入，避免逐张 setImage 互相覆盖
      handlePaste: (view, event) => {
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
        if (imageFiles.length === 0) {
          // ============= 代码粘贴 =============
          // 代码块内粘贴走 PM 默认（按纯文本插入）
          const { $from } = view.state.selection
          if ($from.parent.type.name === 'codeBlock') return false
          const text = event.clipboardData?.getData('text/plain') ?? ''
          if (!text) return false

          // ① IDE 复制的代码：VS Code/Cursor 会带 vscode-editor-data（含语言），直接建代码块
          const vscodeMeta = event.clipboardData?.getData('vscode-editor-data')
          if (vscodeMeta) {
            let language = 'plaintext'
            try {
              const mode = JSON.parse(vscodeMeta)?.mode
              if (typeof mode === 'string' && mode) language = mode
            } catch { /* 元数据坏了按 plaintext */ }
            const code = text.replace(/\r\n/g, '\n').replace(/\n$/, '')
            const { schema } = view.state
            const node = schema.nodes.codeBlock.create(
              { language },
              code ? schema.text(code) : undefined
            )
            event.preventDefault()
            view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
            return true
          }

          // ② 带 ``` 围栏的纯文本：走块级插入。默认的 clipboardTextParser 用开放 slice，
          // 粘到段落中间时代码块会被拍成行内裸文本（围栏消失）
          if (/```/.test(text) && !event.clipboardData?.getData('text/html')) {
            const ed = editorRef.current
            if (ed) {
              event.preventDefault()
              ed.chain().focus().insertContent(text.replace(/\r\n/g, '\n')).run()
              return true
            }
          }
          return false
        }
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
    reviewAnchor,
    skipContentSyncRef,
    handleAIAction,
    handleAccept,
    handleDiscard,
    handleRetry,
    handleFollowUp,
    startAIFromSlashCommand,
  } = useEditorAI({
    editor,
    editorContainerRef,
    onContentChange,
    title,
  })

  const [inlinePromptPos, setInlinePromptPos] = useState<{ top: number; left: number } | null>(null)
  const [inlineHasSelection, setInlineHasSelection] = useState(false)

  // 统一的 AI 输入条入口：Ctrl+J / 气泡菜单 AI 按钮 / 斜杠「自由提问」共用
  const openInlinePrompt = useCallback(() => {
    if (!editor || !editorContainerRef.current || diffState.isActive) return
    const { from, to } = editor.state.selection
    const coords = editor.view.coordsAtPos(from)
    const containerRect = editorContainerRef.current.getBoundingClientRect()
    setInlineHasSelection(from !== to)
    setInlinePromptPos({
      top: coords.bottom - containerRect.top + 4,
      left: Math.max(0, coords.left - containerRect.left),
    })
  }, [editor, editorContainerRef, diffState.isActive])

  // 包装斜杠命令回调，拦截 show-inline-prompt
  const handleSlashAction = useCallback((action: string, templateType?: string) => {
    if (action === 'show-inline-prompt') {
      openInlinePrompt()
      return
    }
    startAIFromSlashCommand(action, templateType)
  }, [openInlinePrompt, startAIFromSlashCommand])

  const { slashMenuPos, slashQuery, slashCommands, closeSlashMenu } = useSlashCommand({
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        openInlinePrompt()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openInlinePrompt])

  // ============= 链接悬停卡 =============
  const [linkPopover, setLinkPopover] = useState<LinkPopoverState | null>(null)
  const linkHideTimerRef = useRef<number | null>(null)

  const cancelLinkHide = useCallback(() => {
    if (linkHideTimerRef.current !== null) {
      clearTimeout(linkHideTimerRef.current)
      linkHideTimerRef.current = null
    }
  }, [])

  const scheduleLinkHide = useCallback(() => {
    cancelLinkHide()
    linkHideTimerRef.current = window.setTimeout(() => {
      // 编辑态不被鼠标移开打断
      setLinkPopover((cur) => (cur && cur.mode === 'edit' ? cur : null))
    }, 300)
  }, [cancelLinkHide])

  // 悬停外链显示操作卡（note:// 内链单击直跳，不需要卡片）
  useEffect(() => {
    if (!editor || !editorContainerRef.current) return
    const dom = editor.view.dom

    const onOver = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      const a = t.closest('a')
      if (!a || !dom.contains(a)) return
      const href = a.getAttribute('href')
      if (!href || href.startsWith('note://')) return
      cancelLinkHide()
      let range: { from: number; to: number } | null = null
      try {
        const pos = editor.view.posAtDOM(a, 0)
        range = getMarkRange(editor.state.doc.resolve(pos), editor.state.schema.marks.link) ?? null
      } catch { /* DOM 与文档瞬时不同步，忽略 */ }
      if (!range) return
      const rect = a.getBoundingClientRect()
      const cRect = editorContainerRef.current!.getBoundingClientRect()
      setLinkPopover((cur) => {
        if (cur && cur.mode === 'edit') return cur
        return {
          top: rect.bottom - cRect.top + 6,
          left: Math.max(0, Math.min(rect.left - cRect.left, cRect.width - 360)),
          href,
          from: range.from,
          to: range.to,
          mode: 'view',
        }
      })
    }
    const onOut = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && t.closest('a')) scheduleLinkHide()
    }

    dom.addEventListener('mouseover', onOver)
    dom.addEventListener('mouseout', onOut)
    return () => {
      dom.removeEventListener('mouseover', onOver)
      dom.removeEventListener('mouseout', onOut)
      cancelLinkHide()
    }
  }, [editor, editorContainerRef, cancelLinkHide, scheduleLinkHide])

  // 应用链接编辑（悬停卡编辑态 / 气泡菜单插入链接共用）
  const applyLinkEdit = useCallback((href: string) => {
    if (!editor || !linkPopover) return
    editor
      .chain()
      .focus()
      .setTextSelection({ from: linkPopover.from, to: linkPopover.to })
      .extendMarkRange('link')
      .setLink({ href })
      .run()
    setLinkPopover(null)
  }, [editor, linkPopover])

  const removeLink = useCallback(() => {
    if (!editor || !linkPopover) return
    editor
      .chain()
      .focus()
      .setTextSelection({ from: linkPopover.from, to: linkPopover.to })
      .extendMarkRange('link')
      .unsetLink()
      .run()
    setLinkPopover(null)
  }, [editor, linkPopover])

  // 气泡菜单「插入链接」：打开编辑卡（WebView2 里 window.prompt 不可用）
  const openLinkEditor = useCallback(() => {
    if (!editor || !editorContainerRef.current) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const href = (editor.getAttributes('link').href as string) || ''
    const coords = editor.view.coordsAtPos(from)
    const cRect = editorContainerRef.current.getBoundingClientRect()
    setLinkPopover({
      top: coords.bottom - cRect.top + 6,
      left: Math.max(0, Math.min(coords.left - cRect.left, cRect.width - 360)),
      href,
      from,
      to,
      mode: 'edit',
    })
  }, [editor, editorContainerRef])

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

  // 用户是否真正碰过编辑器（聚焦/键入/粘贴/拖放；工具栏命令都带 .focus() 也会命中）。
  // 打开笔记后扩展会自动跑规范化事务（如 prosemirror-tables 的 fixTables），
  // 若把规范化后的 markdown 当作编辑上报，会"没编辑却刷 updated_at"
  const userTouchedRef = useRef(false)
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const touch = () => { userTouchedRef.current = true }
    dom.addEventListener('focus', touch, true)
    dom.addEventListener('keydown', touch, true)
    dom.addEventListener('paste', touch, true)
    dom.addEventListener('drop', touch, true)
    return () => {
      dom.removeEventListener('focus', touch, true)
      dom.removeEventListener('keydown', touch, true)
      dom.removeEventListener('paste', touch, true)
      dom.removeEventListener('drop', touch, true)
    }
  }, [editor])

  // Handle editor updates
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      if (!diffState.isActive) {
        // 用户没碰过编辑器 → 这是打开后的自动规范化，不上报（编辑器内保留规范化结果，
        // 用户真编辑时 getMarkdown 会带上完整内容一起保存）
        if (!userTouchedRef.current) return
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

  // 处理从侧栏插入内容：插入到文末 → 滚动定位 → 插入的块高亮渐隐
  useEffect(() => {
    if (!contentToInsert || !editor || editor.isDestroyed) return

    const sizeBefore = editor.state.doc.content.size

    editor.commands.focus('end')
    // 文末已是空段落就不再垫 '\n\n'，避免插入内容前多出一个空行
    const lastNode = editor.state.doc.lastChild
    const endsEmpty = lastNode?.type.name === 'paragraph' && lastNode.content.size === 0
    editor.commands.insertContent(endsEmpty ? contentToInsert : '\n\n' + contentToInsert)

    // 更新内容（以 Markdown 格式保存）
    const newContent = editor.storage.markdown.getMarkdown()
    onContentChange(newContent)

    // 滚动到插入处，并给新插入的顶层块加一次性闪烁动画（动画结束自动清类）
    editor.commands.scrollIntoView()
    const { doc } = editor.state
    const from = Math.min(sizeBefore, doc.content.size)
    doc.nodesBetween(from, doc.content.size, (node, pos, parent) => {
      if (parent?.type.name !== 'doc' || !node.isBlock) return true
      const dom = editor.view.nodeDOM(pos)
      if (dom instanceof HTMLElement) {
        dom.classList.add('ai-inserted-flash')
        dom.addEventListener('animationend', () => dom.classList.remove('ai-inserted-flash'), { once: true })
      }
      return false
    })

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
          <AIBubbleMenu editor={editor} onOpenAIPrompt={openInlinePrompt} onEditLink={openLinkEditor} />
          <TableBubbleMenu editor={editor} />
          <EditorContent editor={editor} />

          {/* 斜杠命令菜单 */}
          {slashMenuPos && (
            <SlashCommand
              editor={editor}
              items={slashCommands}
              position={slashMenuPos}
              query={slashQuery}
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

          {/* 链接悬停卡：打开/复制/编辑/取消链接 */}
          {linkPopover && (
            <LinkPopover
              state={linkPopover}
              onOpen={(href) => {
                openUrl(href)
                setLinkPopover(null)
              }}
              onApply={applyLinkEdit}
              onUnlink={removeLink}
              onModeChange={(mode) => setLinkPopover((cur) => (cur ? { ...cur, mode } : cur))}
              onClose={() => setLinkPopover(null)}
              onMouseEnter={cancelLinkHide}
              onMouseLeave={() => {
                if (linkPopover.mode === 'view') scheduleLinkHide()
              }}
            />
          )}

          {/* Ctrl+J 内联提问 */}
          {inlinePromptPos && !diffState.isActive && (
            <AIInlinePrompt
              position={inlinePromptPos}
              hasSelection={inlineHasSelection}
              onSubmit={(prompt) => {
                handleAIAction('custom', prompt)
                setInlinePromptPos(null)
              }}
              onQuickAction={(action) => {
                handleAIAction(action)
                setInlinePromptPos(null)
              }}
              onClose={() => setInlinePromptPos(null)}
            />
          )}

          {/* AI 审查条：浮动在生成内容旁（拿不到锚点时兜底居中固定） */}
          {diffState.isActive && (
            <div
              className={reviewAnchor ? 'absolute z-40' : 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50'}
              style={reviewAnchor ?? undefined}
            >
              <AIReviewToolbar
                isStreaming={diffState.isStreaming}
                onAccept={handleAccept}
                onDiscard={handleDiscard}
                onRetry={handleRetry}
                onFollowUp={handleFollowUp}
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
