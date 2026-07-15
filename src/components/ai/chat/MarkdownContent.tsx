import { memo, useMemo, useState, type ReactNode, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'

// 流式渲染的性能核心：按块拆分 markdown，逐块 memo。
// 流式期间只有最后一块的字符串在变，前面块引用不变直接跳过重渲——
// 否则每个 chunk 都全文重跑 ReactMarkdown，长回复会明显卡顿。

// 围栏感知拆块：空行分块，例外——
// 1. 围栏内的空行不是边界（闭栏须匹配开栏字符且长度不短于开栏，避免嵌套/混用失锁）
// 2. 空行后的下一非空行是缩进行（列表续行/悬挂缩进）时不切，否则 4 空格续行会被独立成代码块
// 已知取舍：松散列表会被切成相邻两个列表、跨块的引用式链接定义失效（流式分块渲染的固有代价）
function splitBlocks(markdown: string): string[] {
  const lines = markdown.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let fence: { char: string; len: number } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line.trimStart())
    if (fenceMatch) {
      const char = fenceMatch[1][0]
      const len = fenceMatch[1].length
      if (!fence) {
        fence = { char, len }
      } else if (char === fence.char && len >= fence.len) {
        fence = null
      }
      current.push(line)
      continue
    }
    if (!fence && line.trim() === '') {
      if (current.length === 0) continue
      // 向后找下一个非空行：缩进的续行意味着仍属当前块
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      if (j < lines.length && /^[ \t]/.test(lines[j])) {
        current.push(line)
        continue
      }
      blocks.push(current.join('\n'))
      current = []
      continue
    }
    current.push(line)
  }
  if (current.length > 0) blocks.push(current.join('\n'))
  return blocks
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)

  // 从 <pre> 的子元素 <code className="language-x"> 里取语言与原文
  let language = ''
  let rawText = ''
  if (isValidElement(children)) {
    const props = children.props as { className?: string; children?: ReactNode }
    const match = /language-(\w+)/.exec(props.className || '')
    if (match) language = match[1]
    rawText = typeof props.children === 'string' ? props.children : String(props.children ?? '')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText.replace(/\n$/, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="ai-code-block group/code relative my-2 rounded-lg overflow-hidden border border-black/[0.06] dark:border-white/[0.08]">
      <div className="flex items-center justify-between px-3 py-1 bg-black/[0.03] dark:bg-white/[0.04] border-b border-black/[0.04] dark:border-white/[0.06]">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono select-none">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover/code:opacity-100 transition-opacity"
          title="复制代码"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
        </button>
      </div>
      <pre className="!my-0 !rounded-none !border-0 overflow-x-auto">{children}</pre>
    </div>
  )
}

const MdBlock = memo(function MdBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      }}
    >
      {text}
    </ReactMarkdown>
  )
})

interface MarkdownContentProps {
  content: string
  /** 流式中：最后一块随流更新（占位参数，视觉上不加光标——用户反馈闪烁光标碍眼） */
  streaming?: boolean
}

export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  const blocks = useMemo(() => splitBlocks(content), [content])

  return (
    <div className="ai-chat-message prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
      {blocks.map((block, i) => (
        <MdBlock key={i} text={block} />
      ))}
    </div>
  )
})
