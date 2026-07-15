import type { StreamSegment } from '../../../hooks/useChat'
import { MarkdownContent } from './MarkdownContent'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from './ToolCallCard'

// 思考/文字/工具段的统一渲染（历史消息与流式输出共用）。
// 流式时只有最后一个文字段带光标并随流更新。
export function renderSegments(segments: StreamSegment[], streaming: boolean) {
  const lastTextIdx = segments.reduce((acc, s, i) => (s.type === 'text' ? i : acc), -1)
  return segments.map((seg, idx) => {
    if (seg.type === 'thinking') {
      return <ThinkingBlock key={idx} content={seg.content} durationMs={seg.durationMs} streaming={streaming} />
    }
    if (seg.type === 'tool_call') {
      return <ToolCallCard key={idx} name={seg.name} params={seg.params} result={seg.result} />
    }
    return <MarkdownContent key={idx} content={seg.content} streaming={streaming && idx === lastTextIdx} />
  })
}
