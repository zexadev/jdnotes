import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

// 匹配字面 [[标题]]（内部不含中括号/换行）。AI agent、粘贴、手打的 wiki 链接都走这里。
const WIKI_RE = /\[\[([^[\]\n]+?)\]\]/g

// 扫描全文文本，给每个 [[标题]] 加行内装饰（不改文档，Markdown 原样往返）。
// 跳过代码块与内联代码里的 [[，避免把示例代码误当引用。
function buildDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text) return
    if (parent && parent.type.name === 'codeBlock') return
    if (node.marks.some((m) => m.type.name === 'code')) return
    const text = node.text
    WIKI_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WIKI_RE.exec(text)) !== null) {
      const from = pos + m.index
      const to = from + m[0].length
      decos.push(
        Decoration.inline(from, to, {
          class: 'note-ref-wiki',
          'data-note-ref-title': m[1],
        })
      )
    }
  })
  return DecorationSet.create(doc, decos)
}

const wikiRefKey = new PluginKey('wikiRef')

// 把正文里字面的 [[标题]] 渲染成可点击引用（按标题解析、单击跳转由 Editor 的 click 处理）
export const WikiRef = Extension.create({
  name: 'wikiRef',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: wikiRefKey,
        state: {
          init: (_config, { doc }) => buildDecorations(doc),
          apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return wikiRefKey.getState(state)
          },
        },
      }),
    ]
  },
})
