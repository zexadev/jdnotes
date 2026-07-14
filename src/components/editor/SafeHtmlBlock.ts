import { Extension } from '@tiptap/core'

// Markdown 扩展开着 html:true（复杂表格回退 HTML 需要），但 markdown-it 原版 html_block
// 规则里 <script>/<style>/<pre>/<textarea>/<!-- 这五类块要等到闭合标记才结束——
// 笔记里出现未闭合的这类原始文本（AI 经 MCP 写入、同步、粘贴的网页代码）时，
// 重载解析会把其后【直到文末】的全部内容吞进原始 HTML 块，图片引用和正文随之丢失，
// 再一保存就永久没了（附件目录里的孤儿文件就是这么来的）。
// 这里用同规则的有界版替换：任何 HTML 块最多延伸到下一个空行。
// 编辑器自产的 HTML 回退（表格等）是单行 outerHTML，不受影响。

/* eslint-disable @typescript-eslint/no-explicit-any */

// 以下正则与块级标签名抄自 markdown-it（lib/common/html_re.js、html_blocks.js），保持行为一致
const attrName = '[a-zA-Z_:][a-zA-Z0-9:._-]*'
const unquoted = '[^"\'=<>`\\x00-\\x20]+'
const singleQuoted = "'[^']*'"
const doubleQuoted = '"[^"]*"'
const attrValue = `(?:${unquoted}|${singleQuoted}|${doubleQuoted})`
const attribute = `(?:\\s+${attrName}(?:\\s*=\\s*${attrValue})?)`
const openTag = `<[A-Za-z][A-Za-z0-9\\-]*${attribute}*\\s*\\/?>`
const closeTag = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>'

const blockNames = [
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
  'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
  'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'section',
  'source', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'track', 'ul',
]

// [起始正则, 终止正则, 是否可打断段落]，顺序与 markdown-it 原版一致
const HTML_SEQUENCES: [RegExp, RegExp, boolean][] = [
  [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
  [/^<!--/, /-->/, true],
  [/^<\?/, /\?>/, true],
  [/^<![A-Z]/, />/, true],
  [/^<!\[CDATA\[/, /\]\]>/, true],
  [new RegExp(`^</?(${blockNames.join('|')})(?=(\\s|/?>|$))`, 'i'), /^$/, true],
  [new RegExp(`^(?:${openTag}|${closeTag})\\s*$`), /^$/, false],
]

function htmlBlockBounded(state: any, startLine: number, endLine: number, silent: boolean): boolean {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]

  if (state.sCount[startLine] - state.blkIndent >= 4) return false
  if (!state.md.options.html) return false
  if (state.src.charCodeAt(pos) !== 0x3c /* < */) return false

  let lineText = state.src.slice(pos, max)
  let i = 0
  for (; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText)) break
  }
  if (i === HTML_SEQUENCES.length) return false
  if (silent) return HTML_SEQUENCES[i][2]

  let nextLine = startLine + 1
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    for (; nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent) break
      pos = state.bMarks[nextLine] + state.tShift[nextLine]
      max = state.eMarks[nextLine]
      lineText = state.src.slice(pos, max)
      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0) nextLine++
        break
      }
      // 与原版的唯一差异：空行必定终止块，未闭合标记不再吞到文末
      if (!/\S/.test(lineText)) break
    }
  }

  state.line = nextLine
  const token = state.push('html_block', '', 0)
  token.map = [startLine, nextLine]
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true)
  return true
}

// raw-text 解析模式的元素：DOMParser 遇到未闭合的这些标签会把字符串剩余部分全部吞进元素内
// （html_block 有界化只管 markdown-it 层，渲染出的 HTML 字符串进 DOMParser 还会吞一次），
// 一律转义成字面文本——这些元素本来就不在编辑器 schema 里，转义后代码文本反而不丢
const RAW_TEXT_TAG_RE = /<(\/?)(script|style|textarea|title|iframe|noscript|noembed|noframes|xmp|plaintext)\b/gi
// 没有配对 --> 的注释开口：DOMParser 会把其后一切当注释吞掉
const UNCLOSED_COMMENT_RE = /<!--(?![\s\S]*-->)/g

function neutralizeRawText(html: string): string {
  return html.replace(RAW_TEXT_TAG_RE, '&lt;$1$2').replace(UNCLOSED_COMMENT_RE, '&lt;!--')
}

export const SafeHtmlBlock = Extension.create({
  name: 'safeHtmlBlock',
  // 低于 tiptap-markdown 的 priority(50)：钩子按优先级从高到低执行，
  // 必须等 Markdown 的 onBeforeCreate 建好 storage.markdown.parser 后再替换规则，
  // 同时仍早于首次内容解析（Editor 构造时的 createDocument）
  priority: 40,
  onBeforeCreate() {
    const md = (this.editor.storage as any).markdown?.parser?.md
    if (!md || md.__lapisBoundedHtmlBlock) return
    md.__lapisBoundedHtmlBlock = true
    md.block.ruler.at('html_block', htmlBlockBounded, {
      alt: ['paragraph', 'reference', 'blockquote'],
    })
    md.renderer.rules.html_block = (tokens: any, idx: number) => neutralizeRawText(tokens[idx].content)
    md.renderer.rules.html_inline = (tokens: any, idx: number) => neutralizeRawText(tokens[idx].content)
  },
})
