import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Selection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

// 匹配字面 [[标题]]（内部不含中括号/换行）。AI agent、粘贴、手打的 wiki 链接都走这里。
const WIKI_RE = /\[\[([^[\]\n]+?)\]\]/g

// 扫描全文文本，给每个 [[标题]] 加行内装饰（不改文档，Markdown 原样往返）。
// 默认隐藏 [[ 与 ]]、只把标题渲染成 chip；当选区落在该引用内部时显出完整括号，便于编辑。
// 跳过代码块与内联代码里的 [[，避免把示例代码误当引用。
function buildDecorations(doc: PMNode, selection: Selection): DecorationSet {
  const decos: Decoration[] = []
  const { from: selFrom, to: selTo } = selection
  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text) return
    if (parent && parent.type.name === 'codeBlock') return
    if (node.marks.some((m) => m.type.name === 'code')) return
    const text = node.text
    WIKI_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WIKI_RE.exec(text)) !== null) {
      const mFrom = pos + m.index
      const mTo = mFrom + m[0].length
      const title = m[1]
      // 选区严格落在引用内部（光标在括号之间）→ 编辑态：显示完整 [[标题]] 方便改
      const editing = selFrom < mTo && selTo > mFrom
      if (editing) {
        decos.push(
          Decoration.inline(mFrom, mTo, {
            class: 'note-ref-wiki note-ref-wiki-editing',
            'data-note-ref-title': title,
          })
        )
      } else {
        // 常态：隐藏两侧 [[ ]]，仅标题渲染成可点 chip
        decos.push(Decoration.inline(mFrom, mFrom + 2, { class: 'note-ref-bracket' }))
        decos.push(
          Decoration.inline(mFrom + 2, mTo - 2, {
            class: 'note-ref-wiki',
            'data-note-ref-title': title,
          })
        )
        decos.push(Decoration.inline(mTo - 2, mTo, { class: 'note-ref-bracket' }))
      }
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
          init: (_config, state) => buildDecorations(state.doc, state.selection),
          // 文档变化或选区移动都重算（选区移入引用要显括号、移出要藏括号）
          apply: (tr, old, _oldState, newState) =>
            tr.docChanged || tr.selectionSet
              ? buildDecorations(newState.doc, newState.selection)
              : old,
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
