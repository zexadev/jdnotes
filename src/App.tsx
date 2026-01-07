import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { initializeDefaultNotes, noteOperations, type Note } from './lib/db'
import { useAutoSave, useNotes, useCalendar, recoverPendingSaves } from './hooks'
import { CommandMenu } from './components/modals/CommandMenu'
import { Sidebar, NoteList, MainContent } from './components/layout'
import { ThemeProvider } from './contexts/ThemeContext'
import { SettingsModal } from './components/modals/SettingsModal'
import { AIChatSidebar } from './components/ai/AIChatSidebar'
import { CalendarView, ReminderNotification } from './components/calendar'

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

  // 选择笔记 - 切换笔记时默认进入阅读模式
  const handleSelectNote = (note: Note) => {
    setActiveNoteId(note.id)
    setLocalTitle(note.title)
    setLocalContent(note.content)
    setIsEditing(false) // 切换笔记时默认进入阅读模式
    // 如果当前在日历视图，切换回全部笔记
    if (currentView === 'calendar') {
      setCurrentView('inbox')
    }
  }

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
  useAutoSave({
    noteId: activeNoteId,
    title: localTitle,
    content: localContent,
    delay: 500,
  })

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

      <div className="h-screen w-screen flex overflow-hidden bg-[#F9FBFC] dark:bg-[#0B0D11] transition-colors duration-300">
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

        {/* 日历视图 */}
        {currentView === 'calendar' ? (
          <div className="flex-1 h-full overflow-hidden">
            <CalendarView
              onSelectNote={handleSelectNote}
              onBack={() => setCurrentView('inbox')}
            />
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* 提醒通知组件 */}
      <ReminderNotification
        reminders={calendar.upcomingReminders || []}
        onSelectNote={handleSelectNote}
        onDismiss={handleDismissReminder}
      />
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
