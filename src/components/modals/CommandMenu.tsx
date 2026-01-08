import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Plus, Moon, Sun, Search } from 'lucide-react'
import type { Note } from '../../lib/db'
import { useTheme } from '../../contexts/ThemeContext'

interface CommandMenuProps {
  notes: Note[]
  onSelectNote: (id: number) => void
  onCreateNote: () => void
}

export function CommandMenu({
  notes,
  onSelectNote,
  onCreateNote,
}: CommandMenuProps) {
  const [open, setOpen] = useState(false)
  const { resolvedTheme, toggleTheme } = useTheme()

  // 监听 Ctrl+K / Cmd+K 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelectNote = (id: number) => {
    onSelectNote(id)
    setOpen(false)
  }

  const handleCreateNote = () => {
    onCreateNote()
    setOpen(false)
  }

  const handleToggleTheme = () => {
    toggleTheme()
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* 命令面板 */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-[640px] px-4"
          >
            <Command className="bg-white dark:bg-dark-sidebar rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
              {/* 搜索输入框 */}
              <div className="flex items-center gap-3 px-4 border-b border-gray-100 dark:border-white/10">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <Command.Input
                  autoFocus
                  placeholder="搜索笔记或输入命令..."
                  className="w-full py-4 text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 border-none outline-none bg-transparent"
                />
              </div>

              {/* 命令列表 */}
              <Command.List className="max-h-[300px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  没有找到结果
                </Command.Empty>

                {/* 快捷操作 */}
                <Command.Group heading="快捷操作" className="mb-2">
                  <Command.Item
                    onSelect={handleCreateNote}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-dark-card data-[selected=true]:text-gray-900 dark:data-[selected=true]:text-gray-100"
                  >
                    <Plus className="h-4 w-4" />
                    <span>创建新笔记</span>
                    <kbd className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-dark-card px-1.5 py-0.5 rounded">
                      Enter
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    onSelect={handleToggleTheme}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-dark-card data-[selected=true]:text-gray-900 dark:data-[selected=true]:text-gray-100"
                  >
                    {resolvedTheme === 'dark' ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    <span>{resolvedTheme === 'dark' ? '切换浅色模式' : '切换深色模式'}</span>
                  </Command.Item>
                </Command.Group>

                {/* 笔记列表 */}
                {notes.length > 0 && (
                  <Command.Group heading="笔记" className="mt-2">
                    {notes.map((note) => (
                      <Command.Item
                        key={note.id}
                        value={`${note.title} ${note.content} ${note.tags?.join(' ') ?? ''}`}
                        onSelect={() => handleSelectNote(note.id)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 cursor-pointer data-[selected=true]:bg-gray-100 dark:data-[selected=true]:bg-dark-card data-[selected=true]:text-gray-900 dark:data-[selected=true]:text-gray-100"
                      >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{note.title || '无标题'}</span>
                          {note.tags && note.tags.length > 0 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate block">
                              {note.tags.join(', ')}
                            </span>
                          )}
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
