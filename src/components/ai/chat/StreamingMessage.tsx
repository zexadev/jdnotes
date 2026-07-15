import { memo } from 'react'
import type { StreamSegment } from '../../../hooks/useChat'
import { renderSegments } from './segments'

interface StreamingMessageProps {
  segments: StreamSegment[]
}

// 正在生成的 assistant 消息：思考/文字/工具段实时渲染
export const StreamingMessage = memo(function StreamingMessage({ segments }: StreamingMessageProps) {
  return <div className="py-3">{renderSegments(segments, true)}</div>
})

// 等待首个响应的三点动画（复用全局 ai-thinking-dots 样式）
export function WaitingDots() {
  return (
    <div className="py-3">
      <div className="ai-thinking-dots">
        <span className="ai-dot"></span>
        <span className="ai-dot"></span>
        <span className="ai-dot"></span>
      </div>
    </div>
  )
}
