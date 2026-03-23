import { Check, X, Sparkles } from 'lucide-react'
import { useEffect } from 'react'

interface AIReviewToolbarProps {
  isStreaming: boolean
  onAccept: () => void
  onDiscard: () => void
}

export function AIReviewToolbar({
  isStreaming,
  onAccept,
  onDiscard,
}: AIReviewToolbarProps) {
  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter = Accept
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!isStreaming) {
          onAccept()
        }
      }
      // Escape = Discard
      if (e.key === 'Escape') {
        e.preventDefault()
        onDiscard()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isStreaming, onAccept, onDiscard])

  return (
    <div className="ai-review-toolbar">
      <div className="ai-review-toolbar__container">
        {isStreaming ? (
          <>
            <Sparkles className="ai-review-toolbar__sparkle" />
            <span className="ai-review-toolbar__label">AI 生成中</span>
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
            <Sparkles className="ai-review-toolbar__sparkle ai-review-toolbar__sparkle--done" />
            <button
              onClick={onAccept}
              className="ai-review-toolbar__btn ai-review-toolbar__btn--accept"
              title="接受 (Ctrl+Enter)"
            >
              <Check className="ai-review-toolbar__icon" />
              <span>接受</span>
            </button>
            <div className="ai-review-toolbar__divider" />
            <button
              onClick={onDiscard}
              className="ai-review-toolbar__btn ai-review-toolbar__btn--discard"
              title="放弃 (Esc)"
            >
              <X className="ai-review-toolbar__icon" />
              <span>放弃</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
