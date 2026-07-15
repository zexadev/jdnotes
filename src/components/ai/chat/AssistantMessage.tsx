import { memo, useMemo } from 'react'
import { AlertCircle, Square } from 'lucide-react'
import type { ChatMessage } from '../../../lib/db'
import type { StreamSegment, MessageParts } from '../../../hooks/useChat'
import { MarkdownContent } from './MarkdownContent'
import { MessageActions } from './MessageActions'
import { renderSegments } from './segments'

// 历史 assistant 消息的 content 有两种形态：纯 markdown 文本，或 JSON {parts, stopped}
function parseContent(content: string): { segments: StreamSegment[] | null; stopped: boolean; plainText: string } {
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content) as MessageParts
      if (parsed && Array.isArray(parsed.parts)) {
        const plainText = parsed.parts
          .filter((p): p is Extract<StreamSegment, { type: 'text' }> => p.type === 'text')
          .map((p) => p.content)
          .join('\n\n')
        return { segments: parsed.parts, stopped: parsed.stopped === true, plainText }
      }
    } catch { /* 非 JSON，按纯文本 */ }
  }
  return { segments: null, stopped: false, plainText: content }
}

interface AssistantMessageProps {
  message: ChatMessage
  isAnyStreaming: boolean
  onCopy: (content: string) => void
  onDelete: (id: number) => void
  onRetry: (message: ChatMessage) => void
  onInsertToNote?: (content: string) => void
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  isAnyStreaming,
  onCopy,
  onDelete,
  onRetry,
  onInsertToNote,
}: AssistantMessageProps) {
  const { segments, stopped, plainText } = useMemo(() => parseContent(message.content), [message.content])
  const isError = !segments && plainText.startsWith('错误:')

  if (isError) {
    return (
      <div className="group py-2">
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/[0.04] border border-red-500/10 text-[12px] leading-relaxed text-red-500/90 dark:text-red-400/90">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <span className="min-w-0 break-words">{plainText.slice(3).trim()}</span>
        </div>
        <MessageActions
          onCopy={() => onCopy(plainText)}
          onRetry={() => onRetry(message)}
          onDelete={() => onDelete(message.id)}
          disabled={isAnyStreaming}
        />
      </div>
    )
  }

  return (
    <div className="group py-3">
      {segments ? renderSegments(segments, false) : <MarkdownContent content={plainText || ' '} />}
      {stopped && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500 select-none">
          <Square className="h-2 w-2 fill-current" strokeWidth={0} />
          已停止
        </div>
      )}
      <MessageActions
        onCopy={() => onCopy(plainText)}
        onRetry={() => onRetry(message)}
        onInsert={onInsertToNote && plainText.trim() ? () => onInsertToNote(plainText) : undefined}
        onDelete={() => onDelete(message.id)}
        disabled={isAnyStreaming}
      />
    </div>
  )
})
