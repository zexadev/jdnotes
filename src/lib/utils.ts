import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'

// 与编辑器的 tiptap-markdown 解析行为对齐（html:true、任务列表插件），
// 否则列表/引用块/表格/任务列表的标记符、高亮回退出的裸 <mark> 标签会原样漏进预览
const previewMd = new MarkdownIt({ html: true }).use(taskLists)

type MdToken = ReturnType<MarkdownIt['parse']>[number]

function collectPreviewParts(tokens: MdToken[]): { text: string; code: string } {
  const textParts: string[] = []
  const codeParts: string[] = []
  for (const token of tokens) {
    if (token.type === 'inline') {
      for (const child of token.children ?? []) {
        if (child.type === 'text' || child.type === 'code_inline') {
          textParts.push(child.content)
        } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
          textParts.push(' ')
        }
        // 其余（emphasis/strong/strike/link/image/html_inline 等标记）不产出文字，天然跳过
      }
      textParts.push(' ')
    } else if (token.type === 'fence' || token.type === 'code_block') {
      codeParts.push(token.content)
    }
  }
  return { text: textParts.join(''), code: codeParts.join(' ') }
}

// 从 Markdown 内容提取纯文本预览：真正解析 token 流而非正则替换标记符，
// 覆盖列表/任务列表/引用块/表格/删除线/字面 [[wiki]] 引用/高亮回退 HTML 等正则难以穷举的语法
// 按内容串缓存：预览是对整篇笔记做一次完整 markdown-it 解析，列表每次重渲染（切换选中、进出笔记）
// 都会让上百张卡片各解析一遍，手机上返回列表一次约 100ms 全花在这。同一内容只解析一次；
// 条目超上限整体清空，避免长期编辑累积无界增长
const previewCache = new Map<string, string>()
const PREVIEW_CACHE_MAX = 2000

export function extractPreview(markdown: string): string {
  if (!markdown.trim()) return ''
  const cached = previewCache.get(markdown)
  if (cached !== undefined) return cached
  const { text: rawText, code: rawCode } = collectPreviewParts(previewMd.parse(markdown, {}))
  const text = rawText
    .replace(/\[\[([^[\]\n]+?)\]\]/g, '$1') // 字面 wiki 引用只保留标题
    .replace(/\s+/g, ' ')
    .trim()
  // 纯代码笔记没有其他文字时，用代码内容兜底，避免误显示成"空笔记"
  const result = text || rawCode.replace(/\s+/g, ' ').trim()
  const preview = result.slice(0, 80) + (result.length > 80 ? '...' : '')
  if (previewCache.size >= PREVIEW_CACHE_MAX) previewCache.clear()
  previewCache.set(markdown, preview)
  return preview
}

// 格式化日期（相对时间）
export function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return '今天'
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
}

// 格式化日期为 "YYYY年MM月DD日 HH:mm" 格式
export function formatDateTime(date: Date | number): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

// 格式化为简短时间（仅时间）
export function formatTime(date: Date | number): string {
  const d = new Date(date)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// 判断是否是同一天
export function isSameDay(date1: Date | number, date2: Date | number): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}
