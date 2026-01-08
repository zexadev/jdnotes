import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlock from '@tiptap/extension-code-block'
import Image from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef, useCallback } from 'react'
import { CodeBlockComponent } from './CodeBlockComponent'
import { ResizableImage } from './ResizableImage'
import { AIContextMenu } from '../ai/AIContextMenu'
import { AIReviewToolbar } from '../ai/AIReviewToolbar'
import { SlashCommand } from './SlashCommand'
import { useEditorAI, useSlashCommand } from '../../hooks'
import { useAutoTitle } from '../../hooks/useAutoTitle'
import { formatDateTime, formatTime, isSameDay } from '../../lib/utils'
import { EditorHeader } from './EditorHeader'

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
}: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const diffRef = useRef<HTMLDivElement>(null)

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
        heading: {
          levels: [1, 2, 3],
        },
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
        transformCopiedText: true,
      }),
    ],
    content: content,
    editable: isEditing,
    editorProps: {
      attributes: {
        class:
          'prose prose-slate dark:prose-invert prose-lg max-w-none focus:outline-none min-h-[300px]',
      },
    },
    onCreate: ({ editor }) => {
      const latestContent = contentRef.current
      if (latestContent) {
        editor.commands.setContent(latestContent, { emitUpdate: false })
      }
    },
  })

  const {
    diffState,
    showError,
    ghostPosition,
    contextMenuPos,
    hasSelection,
    skipContentSyncRef,
    handleAIAction,
    handleAccept,
    handleDiscard,
    handleContextMenu,
    closeContextMenu,
    startAIFromSlashCommand,
  } = useEditorAI({
    editor,
    editorContainerRef,
    onContentChange,
    title,
  })

  const { slashMenuPos, slashCommands, closeSlashMenu } = useSlashCommand({
    editor,
    editorContainerRef,
    onAIAction: startAIFromSlashCommand,
    diffStateActive: diffState.isActive,
  })

  // Handle editor updates
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      if (!diffState.isActive) {
        // 记录用户输入产生的内容，用于后续跳过不必要的同步
        const newContent = editor.storage.markdown.getMarkdown()
        console.log('[Editor] handleUpdate - 用户输入:', newContent.substring(0, 50) + '...')
        lastEmittedContentRef.current = newContent
        onContentChange(newContent)
      }
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, diffState.isActive, onContentChange])

  // 当 isEditing 变化时更新编辑器可编辑状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing && !diffState.isActive)
    }
  }, [isEditing, editor, diffState.isActive])

  // 当 content prop 变化时更新编辑器内容
  useEffect(() => {
    console.log('[Editor] content sync useEffect - content 变化:', content.substring(0, 50) + '...')
    console.log('[Editor] content sync useEffect - lastEmittedContentRef:', lastEmittedContentRef.current?.substring(0, 50) + '...')
    
    // 跳过同步标志生效时不更新（AI 操作）
    if (skipContentSyncRef.current) {
      console.log('[Editor] content sync useEffect - 跳过（skipContentSyncRef）')
      return
    }
    
    // 如果 content 是由用户输入产生的，跳过同步
    if (content === lastEmittedContentRef.current) {
      console.log('[Editor] content sync useEffect - 跳过（用户输入产生的）')
      lastEmittedContentRef.current = null // 重置
      return
    }

    if (editor && !editor.isDestroyed && content && !diffState.isActive) {
      // 使用 Markdown 格式进行比较，避免格式差异导致不必要的更新
      const currentMarkdown = editor.storage.markdown.getMarkdown()
      console.log('[Editor] content sync useEffect - currentMarkdown:', currentMarkdown.substring(0, 50) + '...')
      if (content !== currentMarkdown) {
        console.log('[Editor] content sync useEffect - 执行 setContent!')
        editor.commands.setContent(content, { emitUpdate: false })
      } else {
        console.log('[Editor] content sync useEffect - 内容相同，跳过')
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
          className={`mt-6 relative ${!isEditing ? 'cursor-default' : ''}`}
          onContextMenu={handleContextMenu}
        >
          <EditorContent editor={editor} />

          {/* 斜杠命令菜单 */}
          {slashMenuPos && isEditing && (
            <SlashCommand
              editor={editor}
              items={slashCommands}
              position={slashMenuPos}
              onSelect={(item) => item.action(editor)}
              onClose={closeSlashMenu}
            />
          )}

          {/* Ghost Writing 浮动面板 - 定位到光标位置 */}
          {diffState.isActive && ghostPosition && (
            <div
              ref={diffRef}
              className="absolute z-10 max-w-md"
              style={{
                top: ghostPosition.top,
                left: Math.max(0, ghostPosition.left - 8),
              }}
            >
              {/* 原文（灰色半透明删除线） */}
              {diffState.originalText && (
                <div className="ai-ghost-original text-sm mb-1">
                  {diffState.originalText}
                </div>
              )}

              {/* AI 生成内容（靛蓝色） */}
              <div className="flex items-start gap-1">
                <div className="ai-ghost-text text-sm flex-1 whitespace-pre-wrap">
                  {diffState.generatedText}
                  {diffState.isStreaming && (
                    <span className="ai-streaming-cursor" />
                  )}
                </div>

                {/* 内联工具栏 */}
                {(diffState.generatedText || !diffState.isStreaming) && (
                  <AIReviewToolbar
                    isStreaming={diffState.isStreaming}
                    onAccept={handleAccept}
                    onDiscard={handleDiscard}
                  />
                )}
              </div>

              {/* 生成中但还没内容时显示加载状态 */}
              {diffState.isStreaming && !diffState.generatedText && (
                <AIReviewToolbar
                  isStreaming={true}
                  onAccept={handleAccept}
                  onDiscard={handleDiscard}
                />
              )}
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

      {/* AI 右键菜单 */}
      {isEditing && contextMenuPos && !diffState.isActive && (
        <AIContextMenu
          position={contextMenuPos}
          hasSelection={hasSelection}
          onAction={handleAIAction}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}
