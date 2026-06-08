import { useState, useEffect, useMemo } from 'react'
import { X, Send, Search, Check, MonitorSmartphone, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { noteOperations, type Note } from '../../lib/db'
import { toast } from '../../lib/toast'

interface NoteSelectModalProps {
  open: boolean
  onClose: () => void
  /** 目标设备的显示名 */
  deviceName: string
  /** 推送目标地址（局域网 ip:port）；走 iroh 跨网时留空、改用 peerId */
  address: string
  /** 目标设备指纹（mDNS 发现的会带上，用于校验应答方身份防 ARP 冒名；手输地址为空） */
  fingerprint?: string
  /** 跨网目标设备 iroh ID；设了就走 iroh 选发，否则走局域网 address */
  peerId?: string
  /** 同步成功后回调（外层刷新数据并记录上次同步时间） */
  onSynced?: () => void
}

type SyncStats = { sent: number; received: number; inserted: number; updated: number; conflicts: number }

/**
 * 选笔记同步弹窗：从所有笔记里勾选若干，一次性推到指定局域网地址。
 *
 * 设计：借鉴 ExportModal 的多选样式（搜索 / 全选 / 卡片化勾选 / 计数）。
 * 同步过程仍是双向的：会发出选中的、也会收到对方的更新并 merge。
 */
export function NoteSelectModal({ open, onClose, deviceName, address, fingerprint, peerId, onSynced }: NoteSelectModalProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // 打开时加载笔记列表 + 关闭时重置
  useEffect(() => {
    if (open) {
      setIsLoading(true)
      noteOperations
        .getAll()
        .then((all) =>
          // 私有笔记不会同步，直接从可选列表里排除（避免误勾然后被后端拒绝的体验）
          setNotes(
            all
              .filter((n) => n.isDeleted === 0 && (n.isPrivate ?? 0) === 0)
              .sort((a, b) => +b.updatedAt - +a.updatedAt)
          )
        )
        .catch(() => toast.error('加载笔记失败'))
        .finally(() => setIsLoading(false))
    } else {
      setSelectedIds(new Set())
      setSearchQuery('')
    }
  }, [open])

  // ESC 关闭（同步中禁用）
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSyncing) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isSyncing, onClose])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return notes
    const q = searchQuery.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags?.some((t) => t.toLowerCase().includes(q))
    )
  }, [notes, searchQuery])

  const allSelected = filtered.length > 0 && filtered.every((n) => selectedIds.has(n.id))
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () => {
    if (allSelected) {
      // 反选当前筛选集合
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((n) => next.delete(n.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((n) => next.add(n.id))
        return next
      })
    }
  }

  const handleSync = async () => {
    if (selectedIds.size === 0) return
    const noteIds = Array.from(selectedIds)
    setIsSyncing(true)
    try {
      const stats = peerId
        ? await invoke<SyncStats>('sync_iroh_push_notes', { peerId, noteIds })
        : await invoke<SyncStats>('sync_lan_push_notes', { address, noteIds, fingerprint })
      const local =
        stats.inserted > 0 || stats.updated > 0
          ? `本机新增 ${stats.inserted}、更新 ${stats.updated}`
          : '本机已是最新'
      const base = `已发出 ${stats.sent} 条给「${deviceName}」；${local}`
      const full =
        stats.conflicts > 0 ? `${base}；${stats.conflicts} 处冲突已存为「冲突副本」笔记，请核对` : base
      if (stats.conflicts > 0) toast.warning(full, { duration: 7000 })
      else toast.success(full, { duration: 6000 })
      onSynced?.()
      onClose()
    } catch (e) {
      toast.error('同步失败：' + (e instanceof Error ? e.message : String(e)), { duration: 7000 })
    }
    setIsSyncing(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSyncing && onClose()}
      />

      {/* 模态框 */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center shrink-0">
              <MonitorSmartphone className="h-4 w-4 text-[#5E6AD2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                同步到「{deviceName}」
              </h2>
              <p className="text-[11px] font-mono text-gray-400 truncate">{address}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSyncing}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors disabled:opacity-40"
            title="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 工具栏：搜索 + 全选 + 计数 */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题、内容或标签…"
              className="w-full pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAll}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-40"
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  allSelected
                    ? 'bg-[#5E6AD2] border-[#5E6AD2]'
                    : someSelected
                    ? 'bg-[#5E6AD2]/50 border-[#5E6AD2]'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {(allSelected || someSelected) && <Check className="h-3 w-3 text-white" />}
              </div>
              {allSelected ? '取消全选' : '全选'}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              已选 <span className="font-medium text-[#5E6AD2]">{selectedIds.size}</span> /{' '}
              {filtered.length} 条
            </span>
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#5E6AD2]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? '没有匹配的笔记' : '没有可同步的笔记（私有笔记已排除）'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  onClick={() => toggleOne(n.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedIds.has(n.id)
                      ? 'bg-[#5E6AD2]/10 dark:bg-[#5E6AD2]/20 border border-[#5E6AD2]/30'
                      : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <div
                    className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(n.id)
                        ? 'bg-[#5E6AD2] border-[#5E6AD2]'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {selectedIds.has(n.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {n.title || '无标题'}
                      </h3>
                      {n.isFavorite === 1 && <span className="text-yellow-500 text-xs">⭐</span>}
                    </div>
                    {n.tags && n.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {n.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                          >
                            {t}
                          </span>
                        ))}
                        {n.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{n.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {n.content.replace(/<[^>]*>/g, '').slice(0, 100) || '暂无内容'}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      更新于 {n.updatedAt.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed flex-1">
            同步是双向的：你发出选中的，对方也会发回它的更新；改同处自动生成「冲突副本」笔记，不会静默丢数据。
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onClose}
              disabled={isSyncing}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-40"
            >
              取消
            </button>
            <button
              onClick={handleSync}
              disabled={selectedIds.size === 0 || isSyncing}
              className="px-4 py-2 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  同步中…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  同步 {selectedIds.size} 条
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
