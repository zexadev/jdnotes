import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Editor } from '@tiptap/react'
import { getDefaultSlashCommands } from '../components/editor/SlashCommand'

interface UseSlashCommandProps {
  editor: Editor | null
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  onAIAction: (action: string, templateType?: string) => void
  diffStateActive: boolean
}

export function useSlashCommand({
  editor,
  editorContainerRef,
  onAIAction,
  diffStateActive,
}: UseSlashCommandProps) {
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null)
  // 过滤词 = 编辑器里 '/' 之后的真实文本（单一事实来源，中文/IME 天然支持）
  const [slashQuery, setSlashQuery] = useState('')
  const slashStartPosRef = useRef<number | null>(null)

  // 关闭斜杠菜单
  const closeSlashMenu = useCallback(() => {
    setSlashMenuPos(null)
    setSlashQuery('')
    slashStartPosRef.current = null
  }, [])

  // 删除斜杠字符的工具函数
  const deleteSlashChar = useCallback(() => {
    if (!editor) return
    if (slashStartPosRef.current !== null) {
      const { from } = editor.state.selection
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashStartPosRef.current, to: from })
        .run()
    }
  }, [editor])

  // 处理 AI 类斜杠命令选中
  const handleAISlashSelect = useCallback(
    (action: string, templateType?: string) => {
      if (!editor || !editorContainerRef.current) return
      deleteSlashChar()
      closeSlashMenu()
      onAIAction(action, templateType)
    },
    [editor, editorContainerRef, deleteSlashChar, closeSlashMenu, onAIAction]
  )

  // 获取菜单项，包装编辑器命令使其也删除斜杠
  const slashCommands = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs -- handleAISlashSelect 是 useCallback 回调，非 ref
    const commands = getDefaultSlashCommands(handleAISlashSelect)
    return commands.map((cmd) => {
      if (cmd.group !== 'ai') {
        const originalAction = cmd.action
        return {
          ...cmd,
          action: (ed: Editor) => {
            deleteSlashChar()
            closeSlashMenu()
            originalAction(ed)
          },
        }
      }
      return cmd
    })
  }, [handleAISlashSelect, deleteSlashChar, closeSlashMenu])

  // 监听输入和键盘事件
  useEffect(() => {
    if (!editor || !editorContainerRef.current) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果斜杠菜单已打开且按下 Escape，关闭菜单
      if (slashMenuPos && event.key === 'Escape') {
        closeSlashMenu()
        return
      }
    }

    const handleInput = () => {
      if (!editor || !editorContainerRef.current || diffStateActive) return

      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from)

      // / 必须在段落开头,或前一个字符是空白/换行才触发菜单,避免在词中间(如 "abc/")误触发
      const $from = editor.state.selection.$from
      const isAtBlockStart = $from.parentOffset === 1
      let prevChar = ''
      if (!isAtBlockStart && from >= 2) {
        prevChar = editor.state.doc.textBetween(from - 2, from - 1, ' ')
      }
      const isAfterWhitespace = prevChar === ' ' || prevChar === '\t' || prevChar === '\n'

      if (textBefore === '/' && (isAtBlockStart || isAfterWhitespace)) {
        // 显示斜杠菜单 - 预先计算位置，避免超出可视区域
        const coords = editor.view.coordsAtPos(from)
        const containerRect = editorContainerRef.current.getBoundingClientRect()

        // 预估菜单尺寸：有滚动区域限制 max-h-[320px]，加上搜索提示和底栏
        const menuHeight = 360
        const menuWidth = 288 // w-72 = 18rem = 288px
        const margin = 12

        // 找到编辑器所在的滚动容器的可视边界
        const scrollParent = editorContainerRef.current.closest('.overflow-y-auto')
        const visibleBottom = scrollParent
          ? scrollParent.getBoundingClientRect().bottom
          : window.innerHeight

        let top = coords.bottom - containerRect.top + 4
        let left = coords.left - containerRect.left

        // 底部超出可视区域：改为向上弹出
        if (coords.bottom + menuHeight + margin > visibleBottom) {
          top = coords.top - containerRect.top - menuHeight - 4
        }

        // 右侧超出
        if (coords.left + menuWidth > window.innerWidth - margin) {
          left = window.innerWidth - margin - menuWidth - containerRect.left
        }

        // 确保不超出顶部和左侧（相对于容器）
        if (top < 0) top = 4
        if (left < 0) left = 4

        setSlashMenuPos({ top, left })
        setSlashQuery('')
        slashStartPosRef.current = from - 1
      } else if (slashMenuPos) {
        // 菜单开着：'/' 之后的文本就是过滤词；'/' 被删或输入空格则关闭
        const textFromSlash = editor.state.doc.textBetween(
          slashStartPosRef.current || 0,
          from
        )
        if (!textFromSlash.startsWith('/') || textFromSlash.includes(' ') || textFromSlash.length > 24) {
          closeSlashMenu()
        } else {
          setSlashQuery(textFromSlash.slice(1))
        }
      }
    }

    // 光标移出 '/' 区域（点击别处/方向键跳走）即关闭
    const handleSelectionChange = () => {
      if (!slashMenuPos || slashStartPosRef.current === null || !editor) return
      const { from, to } = editor.state.selection
      if (from !== to || from <= slashStartPosRef.current || from > slashStartPosRef.current + 25) {
        closeSlashMenu()
      }
    }

    editor.on('update', handleInput)
    editor.on('selectionUpdate', handleSelectionChange)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      editor.off('update', handleInput)
      editor.off('selectionUpdate', handleSelectionChange)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, editorContainerRef, slashMenuPos, closeSlashMenu, diffStateActive])

  return {
    slashMenuPos,
    slashQuery,
    slashCommands,
    closeSlashMenu,
  }
}
