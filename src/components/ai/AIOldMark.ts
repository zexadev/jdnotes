import { Mark, mergeAttributes } from '@tiptap/core'

// AI 就地 diff 的「原文」标记：红色删除线，与 aiHighlight（新文本，绿色）成对使用。
// 接受 = 删除带此标记的原文；放弃 = 移除此标记恢复原样
export const AIOld = Mark.create({
  name: 'aiOld',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'ai-old',
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span.ai-old' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})
