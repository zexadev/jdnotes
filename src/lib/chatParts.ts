// assistant 消息持久化形态的统一解析：
// 纯 markdown 文本，或 JSON {parts: StreamSegment[], stopped?}（含思考/工具段或被停止的消息）。
// UI 渲染与 buildAIMessages 回传模型共用——回传必须只取 text 段，
// 把 parts JSON 原样发回去会让模型收到思考全文和 JSON 大字符串。

export type StreamSegment =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; params: Record<string, unknown>; result?: string }
  | { type: 'thinking'; content: string; durationMs?: number }

export interface MessageParts {
  parts: StreamSegment[]
  stopped?: boolean
}

export function parseMessageParts(content: string): { segments: StreamSegment[] | null; stopped: boolean; plainText: string } {
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content) as MessageParts
      if (parsed && Array.isArray(parsed.parts)) {
        return { segments: parsed.parts, stopped: parsed.stopped === true, plainText: partsPlainText(parsed.parts) }
      }
    } catch { /* 非 JSON，按纯文本 */ }
  }
  return { segments: null, stopped: false, plainText: content }
}

export function partsPlainText(parts: StreamSegment[]): string {
  return parts
    .filter((p): p is Extract<StreamSegment, { type: 'text' }> => p.type === 'text')
    .map((p) => p.content)
    .join('\n\n')
}

// 回传模型的历史内容：parts JSON → 纯文本；纯文本原样
export function contentForModel(content: string): string {
  return parseMessageParts(content).plainText
}

// 把对话历史序列化成给「压缩器」读的纯文本。
// assistant 的 parts 只留文本 + 工具名（原始工具输出不进摘要请求，太大且摘要里也该丢弃）；
// 单条超长内容截断，防止一条巨型粘贴把压缩请求自身撑爆
const COMPACT_ITEM_CLIP = 8000
function clipForCompact(text: string): string {
  return text.length > COMPACT_ITEM_CLIP ? text.slice(0, COMPACT_ITEM_CLIP) + '…（超长内容已截断）' : text
}

export function serializeForCompact(messages: { role: string; content: string; images?: string[] }[]): string {
  const lines: string[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      const imgNote = m.images && m.images.length > 0 ? `（附 ${m.images.length} 张图片）` : ''
      lines.push(`【用户】${clipForCompact(m.content)}${imgNote}`)
    } else if (m.role === 'assistant') {
      const { segments, plainText } = parseMessageParts(m.content)
      const toolNames = (segments ?? [])
        .filter((s): s is Extract<StreamSegment, { type: 'tool_call' }> => s.type === 'tool_call')
        .map((s) => s.name)
      const toolNote = toolNames.length > 0 ? `[调用了工具: ${toolNames.join(', ')}] ` : ''
      lines.push(`【助手】${toolNote}${clipForCompact(plainText)}`)
    } else if (m.role === 'summary') {
      lines.push(`【此前的对话摘要】${m.content}`)
    }
  }
  return lines.join('\n\n')
}
