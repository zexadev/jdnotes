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
  const slashStartPosRef = useRef<number | null>(null)

  // 关闭斜杠菜单
  const closeSlashMenu = useCallback(() => {
    setSlashMenuPos(null)
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
    const commands = getDefaultSlashCommands(handleAISlashSelect)
    return commands.map((cmd) => {
      if (cmd.group === 'editor') {
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

      if (textBefore === '/') {
        // 显示斜杠菜单 - 预先计算位置，避免超出可视区域
        const coords = editor.view.coordsAtPos(from)
        const containerRect = editorContainerRef.current.getBoundingClientRect()

        // 预估菜单尺寸：2 个分组标题(28px) + 6 个命令项(40px) + 底部提示(28px) + padding(8px)
        const menuHeight = 2 * 28 + 6 * 40 + 28 + 8
        const menuWidth = 256 // w-64 = 16rem = 256px
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
        slashStartPosRef.current = from - 1
      } else if (slashMenuPos) {
        // 如果输入了其他字符，关闭菜单
        const textFromSlash = editor.state.doc.textBetween(
          slashStartPosRef.current || 0,
          from
        )
        if (!textFromSlash.startsWith('/') || textFromSlash.includes(' ')) {
          closeSlashMenu()
        }
      }
    }

    editor.on('update', handleInput)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      editor.off('update', handleInput)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, editorContainerRef, slashMenuPos, closeSlashMenu, diffStateActive])

  return {
    slashMenuPos,
    slashCommands,
    closeSlashMenu,
  }
}
