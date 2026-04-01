import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { initializeDefaultNotes, noteOperations, type Note } from './lib/db'
import { useAutoSave, useNotes, useCalendar, recoverPendingSaves } from './hooks'
import { listen } from '@tauri-apps/api/event'
import { CommandMenu } from './components/modals/CommandMenu'
import { Sidebar, NoteList, MainContent, TitleBar } from './components/layout'
import { ThemeProvider } from './contexts/ThemeContext'
import { SettingsModal } from './components/modals/SettingsModal'
import { AIChatSidebar } from './components/ai/AIChatSidebar'
import { CalendarView, ReminderNotification } from './components/calendar'
import { ToastContainer } from './components/common/Toast'
import { toast } from './lib/toast'
import { SettingsPage } from './pages/SettingsPage'
import { DashboardPage } from './pages/DashboardPage'

// 视图类型
type ViewType = 'dashboard' | 'inbox' | 'favorites' | 'trash' | 'calendar' | 'settings' | `tag-${string}`

function App() {
  const [isReady, setIsReady] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [localTitle, setLocalTitle] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [showSettings, setShowSettings] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [contentToInsert, setContentToInsert] = useState<string | null>(null)
  const [toasts, setToasts] = useState(toast.getToasts())

  // 订阅 toast 变化
  useEffect(() => {
    return toast.subscribe(() => {
      setToasts([...toast.getToasts()])
    })
  }, [])

  // 追踪已知存在的笔记 ID（用于区分新建和删除）
  const knownNoteIdsRef = useRef<Set<number>>(new Set())

  const {
    notes,
    allTags,
    allNotes,
    counts,
    createNote,
    deleteNote,
    restoreNote,
    permanentDeleteNote,
    toggleFavorite,
    updateTags,
    refreshNotes,
  } = useNotes(searchQuery, currentView)

  // 使用 useCalendar 获取提醒相关功能
  const calendar = useCalendar()

  // 设置笔记提醒
  const handleSetReminder = useCallback(async (noteId: number, reminderDate: Date) => {
    await noteOperations.setReminder(noteId, reminderDate)
    // 刷新笔记列表以更新 activeNote 的提醒状态
    await refreshNotes()
    // 刷新提醒列表
    await calendar.refreshReminders()
  }, [refreshNotes, calendar])

  // 清除笔记提醒
  const handleClearReminder = useCallback(async (noteId: number) => {
    await noteOperations.clearReminder(noteId)
    // 刷新笔记列表以更新 activeNote 的提醒状态
    await refreshNotes()
    // 刷新提醒列表
    await calendar.refreshReminders()
  }, [refreshNotes, calendar])

  // 提醒通知关闭时清除提醒
  const handleDismissReminder = useCallback(async (noteId: number) => {
    await noteOperations.clearReminder(noteId)
    // 刷新笔记列表以更新工具栏的提醒按钮状态
    await refreshNotes()
    // 刷新提醒列表
    await calendar.refreshReminders()
  }, [refreshNotes, calendar])

  // 切换 AI 聊天侧栏
  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev)
  }, [])

  // Cmd/Ctrl + L 快捷键切换侧栏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        toggleChat()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleChat])

  // 禁用浏览器默认右键菜单
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }
    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  // 监听 MCP 等外部数据库变化，刷新当前打开笔记的内容
  const activeNoteIdRef = useRef<number | null>(null)
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId
  }, [activeNoteId])

  useEffect(() => {
    const unlistenPromise = listen('db:changed', async () => {
      const currentId = activeNoteIdRef.current
      if (currentId) {
        const latestNote = await noteOperations.get(currentId)
        if (latestNote) {
          setLocalTitle(latestNote.title)
          setLocalContent(latestNote.content)
        }
      }
    })
    return () => {
      unlistenPromise.then(unlisten => unlisten())
    }
  }, [])

  // 初始化默认数据并恢复未保存的数据
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeDefaultNotes()
        // 恢复可能因意外关闭而丢失的数据
        await recoverPendingSaves()
        // 初始化后刷新笔记列表
        await refreshNotes()
      } catch (e) {
        console.error('[App] 初始化失败:', e)
      } finally {
        setIsReady(true)
      }
    }
    initialize()
  }, [refreshNotes])

  // 当前选中的笔记
  const activeNote = useMemo(() => {
    if (!notes || activeNoteId === null) return null
    return notes.find((note) => note.id === activeNoteId) || null
  }, [notes, activeNoteId])

  // 更新已知笔记 ID 集合，并处理删除场景
  useEffect(() => {
    if (!notes) return

    const currentIds = new Set(notes.map((n) => n.id))

    // 只有当笔记之前存在于列表中、现在不存在时才清除（真正的删除）
    if (
      activeNoteId !== null &&
      knownNoteIdsRef.current.has(activeNoteId) &&
      !currentIds.has(activeNoteId)
    ) {
      setActiveNoteId(null)
    }

    // 更新已知 ID 集合
    knownNoteIdsRef.current = currentIds
  }, [notes, activeNoteId])

  // 自动保存
  const { saveNoteById, hasUnsavedChanges } = useAutoSave({
    noteId: activeNoteId,
    title: localTitle,
    content: localContent,
    isEditing: true,
    delay: 500,
    onSave: refreshNotes,
  })

  // 选择笔记
  const handleSelectNote = useCallback(async (note: Note) => {
    console.log('[App] handleSelectNote - 点击笔记:', note.id, '当前笔记:', activeNoteId)

    if (note.id === activeNoteId) return

    // 保存当前笔记未保存的变化
    if (activeNoteId !== null && hasUnsavedChanges()) {
      await saveNoteById(activeNoteId, localTitle, localContent)
    }

    // 从数据库获取最新的笔记数据
    const latestNote = await noteOperations.get(note.id)
    if (!latestNote) return

    setActiveNoteId(latestNote.id)
    setLocalTitle(latestNote.title)
    setLocalContent(latestNote.content)
    if (currentView === 'calendar') {
      setCurrentView('inbox')
    }
  }, [activeNoteId, localTitle, localContent, saveNoteById, hasUnsavedChanges, currentView])

  // 创建新笔记
  const handleCreateNote = async () => {
    try {
      if (activeNoteId !== null && hasUnsavedChanges()) {
        await saveNoteById(activeNoteId, localTitle, localContent)
      }

      const id = await createNote()
      setActiveNoteId(Number(id))
      setLocalTitle('无标题')
      setLocalContent('')
    } catch (error) {
      console.error('Failed to create note:', error)
    }
  }

  // 软删除笔记（移到废纸篓）
  const handleDeleteNote = async (id: number) => {
    await deleteNote(id)
    if (activeNoteId === id) {
      setActiveNoteId(null)
    }
  }

  // 切换收藏状态
  const handleToggleFavorite = async (id: number) => {
    await toggleFavorite(id)
  }

  // 恢复笔记
  const handleRestoreNote = async (id: number) => {
    await restoreNote(id)
  }

  // 彻底删除笔记
  const handlePermanentDelete = async (id: number) => {
    await permanentDeleteNote(id)
    if (activeNoteId === id) {
      setActiveNoteId(null)
    }
  }

  // 更新本地标题
  const handleTitleChange = (title: string) => {
    setLocalTitle(title)
  }

  // 更新本地内容
  const handleContentChange = (content: string) => {
    setLocalContent(content)
  }

  // 更新标签
  const handleTagsChange = async (tags: string[]) => {
    if (activeNoteId) {
      await updateTags(activeNoteId, tags)
    }
  }

  // 插入内容到笔记
  const handleInsertToNote = useCallback((content: string) => {
    setContentToInsert(content)
  }, [])

  // 插入完成后清除状态
  const handleContentInserted = useCallback(() => {
    setContentToInsert(null)
  }, [])

  // 从命令面板选择笔记
  const handleCommandSelectNote = (id: number) => {
    const note = notes.find((n) => n.id === id)
    if (note) {
      handleSelectNote(note)
    }
  }

  // 启动加载状态
  if (!isReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FBFC] dark:bg-[#0B0D11] transition-colors duration-300">
        <div className="book-loader">
          <div>
            <ul>
              {[...Array(6)].map((_, i) => (
                <li key={i}>
                  <svg fill="currentColor" viewBox="0 0 90 120">
                    <path d="M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8254834 17.0315359,37.9100387 18.3356243,37.9946823 L18.5,38 L71.5,38 C72.8807119,38 74,36.8807119 74,35.5 C74,34.1192881 72.8807119,33 71.5,33 Z" />
                  </svg>
                </li>
              ))}
            </ul>
          </div>
          <span>Loading</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 全局命令面板 */}
      <CommandMenu
        notes={notes}
        onSelectNote={handleCommandSelectNote}
        onCreateNote={handleCreateNote}
      />

      {/* 设置模态框 */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onDataChange={refreshNotes}
      />

      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F9FBFC] dark:bg-[#0B0D11] transition-colors duration-300">
        {/* 自定义标题栏 */}
        <TitleBar />

        {/* 主内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentView={currentView}
          onViewChange={setCurrentView}
          counts={counts}
          allTags={allTags}
          allNotes={allNotes || []}
          onOpenSettings={() => setCurrentView('settings')}
        />

        <AnimatePresence mode="wait">
          {/* Dashboard 页面 */}
          {currentView === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 h-full"
            >
              <DashboardPage
                onNavigate={(view) => setCurrentView(view)}
                onCreateNote={handleCreateNote}
              />
            </motion.div>
          ) : currentView === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 h-full overflow-hidden"
            >
              <SettingsPage
                onClose={() => setCurrentView('inbox')}
                onDataChange={refreshNotes}
              />
            </motion.div>
          ) : currentView === 'calendar' ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 h-full overflow-hidden"
            >
              <CalendarView
                onSelectNote={handleSelectNote}
                onBack={() => setCurrentView('inbox')}
              />
            </motion.div>
          ) : (
            <motion.div
              key="notes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex-1 flex h-full overflow-hidden"
            >
              <NoteList
                searchQuery={searchQuery}
                currentView={currentView}
                notes={notes}
                activeNoteId={activeNoteId}
                onSelectNote={handleSelectNote}
                onCreateNote={handleCreateNote}
                onDeleteNote={handleDeleteNote}
                onRestoreNote={handleRestoreNote}
                onPermanentDelete={handlePermanentDelete}
              />

              {/* 右侧编辑器 + AI 侧栏 */}
              <div className="flex-1 flex h-full overflow-hidden">
                <MainContent
                  activeNoteId={activeNoteId}
                  activeNote={activeNote}
                  localTitle={localTitle}
                  localContent={localContent}
                  isChatOpen={isChatOpen}
                  contentToInsert={contentToInsert}
                  onTitleChange={handleTitleChange}
                  onContentChange={handleContentChange}
                  onTagsChange={handleTagsChange}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleChat={toggleChat}
                  onCreateNote={handleCreateNote}
                  onContentInserted={handleContentInserted}
                  onSetReminder={handleSetReminder}
                  onClearReminder={handleClearReminder}
                />

                {/* AI 聊天侧栏 */}
                <AIChatSidebar
                  isOpen={isChatOpen}
                  onClose={() => setIsChatOpen(false)}
                  noteId={activeNoteId}
                  noteTitle={localTitle}
                  noteContent={localContent}
                  onInsertToNote={handleInsertToNote}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* 提醒通知组件 */}
      <ReminderNotification
        reminders={calendar.upcomingReminders || []}
        onSelectNote={handleSelectNote}
        onDismiss={handleDismissReminder}
      />

      {/* 全局 Toast 容器 */}
      <ToastContainer toasts={toasts} removeToast={toast.remove} />
    </>
  )
}

function AppWithTheme() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  )
}

export default AppWithTheme
