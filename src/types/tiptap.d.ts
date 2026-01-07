/**
 * TipTap 编辑器类型扩展
 * 解决 tiptap-markdown 扩展的类型安全问题
 */

import '@tiptap/core'

declare module '@tiptap/core' {
  interface Storage {
    markdown: {
      getMarkdown: () => string
    }
  }
}
