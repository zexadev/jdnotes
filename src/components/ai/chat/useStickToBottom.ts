import { useRef, useState, useCallback, useEffect } from 'react'

// 智能粘底滚动：只有用户本就在底部附近时，新内容才自动跟随；
// 用户向上翻阅时不打扰（Cursor 式），并暴露"回到底部"状态。
// 高度变化用 ResizeObserver 监听（图片加载、思考块展开等异步变化，React deps 测不到）。
const BOTTOM_THRESHOLD = 48

export function useStickToBottom(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    atBottomRef.current = true
    setIsAtBottom(true)
  }, [])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    atBottomRef.current = atBottom
    setIsAtBottom(atBottom)
  }, [])

  // 内容高度变化（含异步：图片加载/折叠展开）时，粘底则跟随
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const inner = el.firstElementChild
    if (!inner) return
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  // 内容变化：粘底时用 instant 跟随（流式高频更新下 smooth 会追不上产生橡皮筋感）
  useEffect(() => {
    if (atBottomRef.current) {
      const el = containerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { containerRef, isAtBottom, scrollToBottom, handleScroll }
}
