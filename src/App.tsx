import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { initializeDefaultNotes, noteOperations, type Note } from './lib/db'
import { useAutoSave, useNotes, useCalendar, recoverPendingSaves } from './hooks'
import { CommandMenu } from './components/modals/CommandMenu'
import { Sidebar, NoteList, MainContent, TitleBar } from './components/layout'
import { ThemeProvider } from './contexts/ThemeContext'
import { SettingsModal } from './components/modals/SettingsModal'
import { AIChatSidebar } from './components/ai/AIChatSidebar'
import { CalendarView, ReminderNotification } from './components/calendar'
import { ToastContainer } from './components/common/Toast'
import { toast } from './lib/toast'

// 视图类型
type ViewType = 'inbox' | 'favorites' | 'trash' | 'calendar' | `tag-${string}`

function App() {
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false) // 默认阅读模式
  const [searchQuery, setSearchQuery] = useState('')
  const [localTitle, setLocalTitle] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [currentView, setCurrentView] = useState<ViewType>('inbox')
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

  // Cmd/Ctrl + J 快捷键切换侧栏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
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

  // 初始化默认数据并恢复未保存的数据
  useEffect(() => {
    const initialize = async () => {
      await initializeDefaultNotes()
      // 恢复可能因意外关闭而丢失的数据
      await recoverPendingSaves()
      // 初始化后刷新笔记列表
      await refreshNotes()
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

  // 自动保存 - 只在编辑模式下触发
  const { saveNoteById, hasUnsavedChanges } = useAutoSave({
    noteId: activeNoteId,
    title: localTitle,
    content: localContent,
    isEditing, // 只有编辑模式下才触发自动保存
    delay: 500,
    onSave: refreshNotes, // 保存后刷新列表
  })

  // 选择笔记 - 切换笔记时默认进入阅读模式
  const handleSelectNote = useCallback(async (note: Note) => {
    console.log('[App] handleSelectNote - 点击笔记:', note.id, '当前笔记:', activeNoteId, '编辑模式:', isEditing)
    console.log('[App] handleSelectNote - 当前 localContent:', localContent.substring(0, 50) + '...')

    // 如果点击的是当前笔记,不需要切换
    if (note.id === activeNoteId) {
      console.log('[App] handleSelectNote - 点击的是当前笔记,无需切换')
      return
    }

    // 只有在编辑模式下才需要保存(查看模式不会产生修改)
    if (isEditing && activeNoteId !== null && hasUnsavedChanges()) {
      console.log('[App] handleSelectNote - 编辑模式下有未保存的变化,保存当前笔记:', activeNoteId, '内容:', localContent.substring(0, 50) + '...')
      // 使用 saveNoteById 显式保存当前笔记的最新内容
      await saveNoteById(activeNoteId, localTitle, localContent)
      console.log('[App] handleSelectNote - 保存完成')
    } else {
      console.log('[App] handleSelectNote - 跳过保存(非编辑模式或无变化)')
    }

    // 从数据库获取最新的笔记数据
    console.log('[App] handleSelectNote - 从数据库获取笔记:', note.id)
    const latestNote = await noteOperations.get(note.id)
    if (!latestNote) {
      console.log('[App] handleSelectNote - 笔记不存在')
      return
    }

    console.log('[App] handleSelectNote - 获取到笔记:', latestNote.id, '内容:', latestNote.content.substring(0, 50) + '...')

    // 批量更新状态,减少重渲染
    setActiveNoteId(latestNote.id)
    setLocalTitle(latestNote.title)
    setLocalContent(latestNote.content)
    setIsEditing(false) // 切换笔记时默认进入阅读模式
    // 如果当前在日历视图,切换回全部笔记
    if (currentView === 'calendar') {
      setCurrentView('inbox')
    }
  }, [activeNoteId, localTitle, localContent, isEditing, saveNoteById, hasUnsavedChanges, currentView])

  // 空笔记自动进入编辑模式（作为安全网，确保新笔记进入编辑模式）
  useEffect(() => {
    if (activeNote === null) return

    // 检查是否是新建的空笔记
    const isEmptyNote = activeNote.title === '无标题' && activeNote.content === ''
    if (isEmptyNote) {
      setIsEditing(true)
    }
  }, [activeNote?.id]) // 仅在笔记 ID 变化时触发

  // 创建新笔记
  const handleCreateNote = async () => {
    try {
      // 只有在编辑模式下才需要保存当前笔记
      if (isEditing && activeNoteId !== null && hasUnsavedChanges()) {
        console.log('[App] handleCreateNote - 编辑模式下保存当前笔记:', activeNoteId)
        await saveNoteById(activeNoteId, localTitle, localContent)
      }
      
      const id = await createNote()
      console.log('Created Note ID:', id, typeof id)
      // 确保 ID 是数字类型
      setActiveNoteId(Number(id))
      setLocalTitle('无标题')
      setLocalContent('')
      setIsEditing(true)
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
    // 切换到编辑模式以便插入内容
    setIsEditing(true)
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
          onOpenSettings={() => setShowSettings(true)}
        />

        <AnimatePresence mode="wait">
          {/* 日历视图 */}
          {currentView === 'calendar' ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
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
                  isEditing={isEditing}
                  isChatOpen={isChatOpen}
                  contentToInsert={contentToInsert}
                  onTitleChange={handleTitleChange}
                  onContentChange={handleContentChange}
                  onTagsChange={handleTagsChange}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleEdit={() => setIsEditing(!isEditing)}
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
