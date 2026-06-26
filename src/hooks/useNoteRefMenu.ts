import { useState, useRef, useCallback, useEffect } from 'react'
import { Editor } from '@tiptap/react'

interface UseNoteRefMenuProps {
  editor: Editor | null
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  enabled: boolean
}

/**
 * 笔记引用菜单：输入 `[[` 触发，弹出笔记选择框，选中后插入 note://<uuid> 链接。
 * 复用 useSlashCommand 的「监听 update + coordsAtPos 定位」骨架；查询串直接从文档读，
 * 菜单组件只负责上下选择/确认（不再单独累积 filterText）。
 */
export function useNoteRefMenu({ editor, editorContainerRef, enabled }: UseNoteRefMenuProps) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [query, setQuery] = useState('')
  // 触发用的第一个 `[` 在文档中的位置；非 null 即菜单处于打开态
  const startPosRef = useRef<number | null>(null)

  const closeMenu = useCallback(() => {
    setMenuPos(null)
    setQuery('')
    startPosRef.current = null
  }, [])

  // 选中笔记后：删掉触发用的 `[[` 及其后查询文本，插入 note://<uuid> 引用链接 + 一个空格收尾
  const insertRef = useCallback(
    (uuid: string, title: string) => {
      if (!editor || startPosRef.current === null) return
      const { from } = editor.state.selection
      editor
        .chain()
        .focus()
        .deleteRange({ from: startPosRef.current, to: from })
        .insertContent([
          { type: 'text', text: title || '未命名笔记', marks: [{ type: 'link', attrs: { href: `note://${uuid}` } }] },
          { type: 'text', text: ' ' },
        ])
        .run()
      closeMenu()
    },
    [editor, closeMenu]
  )

  useEffect(() => {
    if (!editor || !editorContainerRef.current) return

    const handleInput = () => {
      if (!editor || !editorContainerRef.current || !enabled) return
      const { from } = editor.state.selection

      if (startPosRef.current === null) {
        // 未打开：光标前两个字符为 [[ 时触发
        const two = from >= 2 ? editor.state.doc.textBetween(from - 2, from) : ''
        if (two !== '[[') return

        const coords = editor.view.coordsAtPos(from)
        const containerRect = editorContainerRef.current.getBoundingClientRect()
        const menuHeight = 360
        const menuWidth = 288
        const margin = 12
        const scrollParent = editorContainerRef.current.closest('.overflow-y-auto')
        const visibleBottom = scrollParent
          ? scrollParent.getBoundingClientRect().bottom
          : window.innerHeight

        let top = coords.bottom - containerRect.top + 4
        let left = coords.left - containerRect.left
        if (coords.bottom + menuHeight + margin > visibleBottom) {
          top = coords.top - containerRect.top - menuHeight - 4
        }
        if (coords.left + menuWidth > window.innerWidth - margin) {
          left = window.innerWidth - margin - menuWidth - containerRect.left
        }
        if (top < 0) top = 4
        if (left < 0) left = 4

        setMenuPos({ top, left })
        setQuery('')
        startPosRef.current = from - 2
      } else {
        // 已打开：触发段被破坏（删掉 [[、换行、光标移到触发点前）就关闭，否则更新查询串
        const start = startPosRef.current
        const text = editor.state.doc.textBetween(start, from, '\n')
        if (from < start || !text.startsWith('[[') || text.includes('\n')) {
          closeMenu()
        } else {
          setQuery(text.slice(2))
        }
      }
    }

    editor.on('update', handleInput)
    return () => {
      editor.off('update', handleInput)
    }
  }, [editor, editorContainerRef, enabled, closeMenu])

  return { noteRefMenuPos: menuPos, noteRefQuery: query, closeNoteRefMenu: closeMenu, insertNoteRef: insertRef }
}
