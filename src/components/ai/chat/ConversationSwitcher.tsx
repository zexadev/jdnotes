import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, Pencil, Trash2, Plus } from 'lucide-react'
import type { Conversation } from '../../../lib/db'

interface ConversationSwitcherProps {
  conversations: Conversation[]
  activeConversationId: number | null
  onSwitch: (id: number) => void
  onCreate: () => void
  onDelete: (id: number) => void
  onRename: (id: number, title: string) => void
}

// 头部对话切换器：下拉列表带弹出动画；hover 出现重命名/删除（删除两段确认防误触），
// 双击标题或点铅笔进入行内重命名，底部固定「新建对话」
export function ConversationSwitcher({
  conversations,
  activeConversationId,
  onSwitch,
  onCreate,
  onDelete,
  onRename,
}: ConversationSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = conversations.find((c) => c.id === activeConversationId)

  // 收起时一并清掉编辑/确认残留态
  const close = useCallback(() => {
    setOpen(false)
    setEditingId(null)
    setConfirmDeleteId(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, close])

  // 删除第一击只是「上膛」，2.5 秒不二次确认自动解除
  const armDelete = (id: number) => {
    setConfirmDeleteId(id)
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 2500)
  }
  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }, [])

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id)
    setEditText(conv.title)
    setConfirmDeleteId(null)
  }

  const commitRename = () => {
    if (editingId === null) return
    const title = editText.trim()
    const original = conversations.find((c) => c.id === editingId)?.title
    if (title && title !== original) onRename(editingId, title)
    setEditingId(null)
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-1 text-[14px] font-medium text-slate-900 dark:text-slate-100 tracking-tight hover:text-[#5E6AD2] transition-colors max-w-[180px]"
        title={active?.title || '新对话'}
      >
        <span className="truncate">{active?.title || '新对话'}</span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute top-full left-0 mt-1.5 w-60 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 origin-top-left"
          >
            <div className="max-h-72 overflow-y-auto">
              <AnimatePresence initial={false}>
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId
                const isEditing = editingId === conv.id
                const isConfirming = confirmDeleteId === conv.id
                return (
                  <motion.div
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.16 }}
                    className="overflow-hidden"
                  >
                  <div
                    className={`group flex items-center gap-1.5 px-2.5 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            commitRename()
                          }
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setEditingId(null)
                          }
                        }}
                        className="flex-1 min-w-0 px-1.5 py-0.5 text-[13px] bg-white dark:bg-slate-900 border border-[#5E6AD2]/50 rounded outline-none text-slate-800 dark:text-slate-200"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            onSwitch(conv.id)
                            close()
                          }}
                          onDoubleClick={() => startEdit(conv)}
                          className="flex-1 min-w-0 text-left truncate"
                          title={`${conv.title}（双击重命名）`}
                        >
                          {conv.title}
                        </button>
                        {isActive && !isConfirming && (
                          <Check className="h-3.5 w-3.5 flex-shrink-0 opacity-70 group-hover:hidden" strokeWidth={2} />
                        )}
                        {/* 确认删除期间强制可见——藏进 hover 会让人以为点了没反应 */}
                        <div className={`items-center gap-0.5 flex-shrink-0 ${isConfirming ? 'flex' : 'hidden group-hover:flex'}`}>
                          {!isConfirming && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEdit(conv)
                              }}
                              className="p-1 text-slate-400 hover:text-[#5E6AD2] rounded transition-colors"
                              title="重命名"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          {conversations.length > 1 && (
                            <motion.button
                              layout
                              whileTap={{ scale: 0.92 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isConfirming) {
                                  setConfirmDeleteId(null)
                                  onDelete(conv.id)
                                } else {
                                  armDelete(conv.id)
                                }
                              }}
                              className={`relative overflow-hidden flex items-center gap-1 rounded transition-colors ${
                                isConfirming
                                  ? 'px-1.5 py-0.5 text-white bg-red-500 hover:bg-red-600'
                                  : 'p-1 text-slate-400 hover:text-red-500'
                              }`}
                              title={isConfirming ? '再点一次确认删除' : '删除对话'}
                            >
                              <Trash2 className="h-3 w-3 flex-shrink-0" />
                              {isConfirming && (
                                <>
                                  <motion.span
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.12 }}
                                    className="text-[10px] whitespace-nowrap font-medium"
                                  >
                                    确认删除
                                  </motion.span>
                                  {/* 2.5s 倒计时线：可视化「确认窗口正在关闭」 */}
                                  <motion.span
                                    initial={{ scaleX: 1 }}
                                    animate={{ scaleX: 0 }}
                                    transition={{ duration: 2.5, ease: 'linear' }}
                                    style={{ originX: 0 }}
                                    className="absolute inset-x-0 bottom-0 h-[2px] bg-white/60"
                                  />
                                </>
                              )}
                            </motion.button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  </motion.div>
                )
              })}
              </AnimatePresence>
            </div>
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-700/70" />
            <button
              onClick={() => {
                close()
                onCreate()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-[#5E6AD2] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              新建对话
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
