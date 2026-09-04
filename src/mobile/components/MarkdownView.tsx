import { memo, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { openUrl } from '@tauri-apps/plugin-opener'
import { parseAttachmentHash, resolveAttachment } from '../lib/attachments'

function AttachmentImage({ src, alt }: { src?: string; alt?: string }) {
  const hash = src ? parseAttachmentHash(src) : null
  const [url, setUrl] = useState<string | null>(hash ? null : (src ?? null))

  useEffect(() => {
    if (!hash) return
    let alive = true
    resolveAttachment(hash).then((resolved) => {
      if (alive) setUrl(resolved)
    })
    return () => {
      alive = false
    }
  }, [hash])

  if (!url) {
    return <span className="block h-24 rounded-lg bg-black/[0.04] dark:bg-white/[0.06]" />
  }
  return <img src={url} alt={alt ?? ''} className="rounded-lg max-w-full h-auto" loading="lazy" />
}

interface MarkdownViewProps {
  content: string
  /** note://<uuid> 内部引用 */
  onOpenNote?: (uuid: string) => void
}

export const MarkdownView = memo(function MarkdownView({ content, onOpenNote }: MarkdownViewProps) {
  return (
    <div className="mobile-prose prose prose-slate dark:prose-invert max-w-none text-[16px] leading-[1.75] prose-headings:font-semibold prose-h1:text-[24px] prose-h2:text-[20px] prose-h3:text-[17px] prose-pre:text-[13px] prose-img:my-3 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => (
            <AttachmentImage src={typeof src === 'string' ? src : undefined} alt={alt} />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                if (!href) return
                if (href.startsWith('note://')) {
                  onOpenNote?.(href.slice('note://'.length))
                } else if (/^https?:\/\//.test(href)) {
                  void openUrl(href)
                }
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
