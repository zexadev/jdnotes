import { useState, useEffect } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { noteOperations } from '../../lib/db'

interface BacklinksProps {
  noteUuid?: string
  onOpenNote: (id: number) => void
}

/**
 * 反向链接面板：列出正文里引用了当前笔记（note://<uuid>）的其它笔记。
 * 进入/切换笔记时懒查询（findBacklinks 走原生 SQLite LIKE，实测万级 ~30ms）；
 * 无反链则整块不渲染，避免干扰。
 */
export function Backlinks({ noteUuid, onOpenNote }: BacklinksProps) {
  const [links, setLinks] = useState<{ id: number; title: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!noteUuid) {
      setLinks([])
      return
    }
    let cancelled = false
    setLoading(true)
    noteOperations
      .findBacklinks(noteUuid)
      .then((rows) => {
        if (!cancelled) setLinks(rows)
      })
      .catch(() => {
        if (!cancelled) setLinks([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [noteUuid])

  // 无 uuid 或查完无反链：不渲染（加载中先不渲染，避免闪一个空框）
  if (!noteUuid || (links.length === 0 && !loading)) return null

  return (
    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-2">
        <Link2 className="h-3.5 w-3.5" />
        <span>被以下笔记引用</span>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className="text-gray-300 dark:text-gray-600">· {links.length}</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => onOpenNote(l.id)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <span className="text-[#5E6AD2] dark:text-[#9aa2f0] shrink-0">↩</span>
            <span className="truncate">{l.title || '未命名笔记'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
