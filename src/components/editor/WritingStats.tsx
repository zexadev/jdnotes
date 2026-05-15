import { useMemo } from 'react'
import type { Editor } from '@tiptap/react'

interface WritingStatsProps {
  editor: Editor
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export function WritingStats({ editor }: WritingStatsProps) {
  const stats = useMemo(() => {
    const text = editor.getText()

    // Character count (via CharacterCount extension)
    const characters = editor.storage.characterCount.characters()

    // Chinese characters
    const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0
    // English words
    const englishWords = text.match(/[a-zA-Z0-9]+/g)?.length ?? 0
    // Total "words" = Chinese chars + English words
    const words = chineseChars + englishWords

    // Reading time: Chinese ~300 chars/min, English ~200 words/min
    const readingMinutes = Math.max(1, Math.ceil(chineseChars / 300 + englishWords / 200))

    // Paragraph count: non-empty top-level block nodes
    let paragraphs = 0
    editor.state.doc.forEach((node) => {
      if (node.textContent.trim().length > 0) {
        paragraphs++
      }
    })

    return { words, characters, readingMinutes, paragraphs }
  }, [editor.state.doc])

  return (
    <div className="flex items-center justify-end px-12 py-1.5 text-[11px] text-slate-400/80 dark:text-slate-500/80 select-none border-t border-black/[0.03] dark:border-white/[0.04]">
      <div className="flex items-center gap-[6px]">
        <span>字数 {formatNumber(stats.words)}</span>
        <span className="text-slate-300 dark:text-slate-600">&middot;</span>
        <span>字符 {formatNumber(stats.characters)}</span>
        <span className="text-slate-300 dark:text-slate-600">&middot;</span>
        <span>阅读 ~{stats.readingMinutes} 分钟</span>
        <span className="text-slate-300 dark:text-slate-600">&middot;</span>
        <span>段落 {formatNumber(stats.paragraphs)}</span>
      </div>
    </div>
  )
}
