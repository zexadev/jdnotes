import { Check, X, Sparkles, RotateCcw, CornerDownLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface AIReviewToolbarProps {
  isStreaming: boolean
  onAccept: () => void
  onDiscard: () => void
  onRetry: () => void
  onFollowUp: (instruction: string) => void
}

// 浮动在生成内容旁的审查条：接受 / 放弃 / 重试 / 追加指令（Cursor 式 follow-up）
export function AIReviewToolbar({
  isStreaming,
  onAccept,
  onDiscard,
  onRetry,
  onFollowUp,
}: AIReviewToolbarProps) {
  const [followUp, setFollowUp] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 快捷键：Ctrl+Enter / Tab 接受，Esc 放弃（组件只在 diff 激活时挂载）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!isStreaming) onAccept()
        return
      }
      if (e.key === 'Tab' && !isStreaming && document.activeElement !== inputRef.current) {
        e.preventDefault()
        onAccept()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onDiscard()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isStreaming, onAccept, onDiscard])

  const submitFollowUp = () => {
    const text = followUp.trim()
    if (!text || isStreaming) return
    setFollowUp('')
    onFollowUp(text)
  }

  return (
    <div className="ai-review-toolbar">
      <div className="ai-review-toolbar__container">
        {isStreaming ? (
          <>
            <Sparkles className="ai-review-toolbar__sparkle" />
            <span className="ai-review-toolbar__label">生成中…</span>
            <button
              onClick={onDiscard}
              className="ai-review-toolbar__btn ai-review-toolbar__btn--stop"
              title="停止 (Esc)"
            >
              <X className="ai-review-toolbar__icon" />
              <span>停止</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onAccept}
              className="ai-review-toolbar__btn ai-review-toolbar__btn--accept"
              title="接受 (Tab / Ctrl+Enter)"
            >
              <Check className="ai-review-toolbar__icon" />
              <span>接受</span>
            </button>
            <button
              onClick={onDiscard}
              className="ai-review-toolbar__btn ai-review-toolbar__btn--discard"
              title="放弃 (Esc)"
            >
              <X className="ai-review-toolbar__icon" />
              <span>放弃</span>
            </button>
            <button
              onClick={onRetry}
              className="ai-review-toolbar__btn ai-review-toolbar__btn--discard"
              title="换一个结果"
            >
              <RotateCcw className="ai-review-toolbar__icon" />
            </button>
            <div className="ai-review-toolbar__divider" />
            {/* 追加指令：以当前结果为底稿再改一轮 */}
            <div className="flex items-center gap-1 pl-1">
              <input
                ref={inputRef}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    submitFollowUp()
                  }
                  // 输入框内 Esc 只清空自己，不放弃整个结果
                  if (e.key === 'Escape' && followUp) {
                    e.stopPropagation()
                    setFollowUp('')
                  }
                }}
                placeholder="继续调整，如：更简短"
                className="w-36 px-1.5 py-0.5 text-[12px] bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
              />
              <button
                onClick={submitFollowUp}
                disabled={!followUp.trim()}
                className="p-1 rounded-md text-slate-400 hover:text-[#5E6AD2] disabled:opacity-30 transition-colors"
                title="按此指令再改一轮 (Enter)"
              >
                <CornerDownLeft className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
