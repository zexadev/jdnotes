import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { initializeDefaultNotes, initDatabase, noteOperations, type Note } from './lib/db'
import { useAutoSave, useNotes, useCalendar, recoverPendingSaves } from './hooks'
import { listen } from '@tauri-apps/api/event'
import { CommandMenu } from './components/modals/CommandMenu'
import { Sidebar, NoteList, MainContent, TitleBar } from './components/layout'
import type { SidebarState } from './components/layout/Sidebar'
import { ThemeProvider } from './contexts/ThemeContext'
import { UpdateAvailableModal } from './components/modals/UpdateAvailableModal'
import { PairingCodeModal } from './components/modals/PairingCodeModal'
import { AIChatSidebar } from './components/ai/AIChatSidebar'
import { CalendarView, ReminderNotification } from './components/calendar'
import { ToastContainer } from './components/common/Toast'
import { toast } from './lib/toast'
import { SettingsPage } from './pages/SettingsPage'
import { DashboardPage } from './pages/DashboardPage'
import { useUpdater } from './hooks/useUpdater'

// 视图类型
type ViewType = 'dashboard' | 'inbox' | 'favorites' | 'trash' | 'calendar' | 'settings' | `tag-${string}`

// 侧栏状态循环顺序
const SIDEBAR_CYCLE: SidebarState[] = ['expanded', 'collapsed', 'hidden']

// 跳过版本的 localStorage key
const SKIPPED_VERSION_KEY = 'jdnotes-skipped-version'

function App() {
  const [isReady, setIsReady] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [localTitle, setLocalTitle] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [contentToInsert, setContentToInsert] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [toasts, setToasts] = useState(toast.getToasts())

  // 侧栏状态（从 localStorage 恢复）
  const [sidebarState, setSidebarState] = useState<SidebarState>(() => {
    const saved = localStorage.getItem('jdnotes-sidebar-state')
    if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') {
      return saved
    }
    return 'expanded'
  })

  // 循环切换侧栏状态（展开 → 收起 → 隐藏 → …）并持久化；Ctrl+\ 与顶栏按钮共用
  const cycleSidebar = useCallback(() => {
    setSidebarState((prev) => {
      const next = SIDEBAR_CYCLE[(SIDEBAR_CYCLE.indexOf(prev) + 1) % SIDEBAR_CYCLE.length]
      localStorage.setItem('jdnotes-sidebar-state', next)
      return next
    })
  }, [])

  // Ctrl+K / Cmd+K 打开/关闭全局命令面板（标题栏搜索框之外的快捷入口）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 始终持有最新视图，供 ref 类回调读取（避免闭包过期）
  const currentViewRef = useRef(currentView)
  currentViewRef.current = currentView
  // 记住「开始搜索前」停留的非列表视图，清空搜索后据此回退
  const viewBeforeSearchRef = useRef<ViewType | null>(null)

  const isNotesListView = (view: ViewType) =>
    view === 'inbox' || view === 'favorites' || view === 'trash' || view.startsWith('tag-')

  // 顶部搜索框输入：在非笔记列表视图下开始搜索时记住当前视图并切到「全部笔记」让结果可见；
  // 清空搜索后回到搜索前的视图（仅当仍停留在自动切入的「全部笔记」，避免覆盖用户手动导航）。
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    const view = currentViewRef.current
    if (value.trim()) {
      if (!isNotesListView(view)) {
        viewBeforeSearchRef.current = view
        setCurrentView('inbox')
      }
    } else if (viewBeforeSearchRef.current) {
      const prev = viewBeforeSearchRef.current
      viewBeforeSearchRef.current = null
      if (currentViewRef.current === 'inbox') setCurrentView(prev)
    }
  }, [])

  // Ctrl+\ 快捷键循环切换侧栏状态
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        cycleSidebar()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cycleSidebar])

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
    deleteNotes,
    restoreNotes,
    permanentDeleteNotes,
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

  // 更新检测
  const updater = useUpdater()
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const hasCheckedUpdateRef = useRef(false)
  const updaterRef = useRef(updater)
  updaterRef.current = updater

  // 启动后延迟检查更新（避开初始化高峰）
  useEffect(() => {
    if (!isReady || hasCheckedUpdateRef.current) return
    hasCheckedUpdateRef.current = true
    const timer = setTimeout(() => {
      updaterRef.current.checkForUpdates().catch((err) => {
        console.error('[App] 启动检查更新失败:', err)
      })
    }, 2000)
    return () => clearTimeout(timer)
  }, [isReady])

  // 检测到新版本时弹窗（跳过用户已忽略的版本）
  useEffect(() => {
    if (updater.status === 'available' && updater.updateInfo) {
      const skipped = localStorage.getItem(SKIPPED_VERSION_KEY)
      if (skipped !== updater.updateInfo.version) {
        setShowUpdateModal(true)
      }
    }
  }, [updater.status, updater.updateInfo])

  const handleSkipUpdate = useCallback(() => {
    if (updater.updateInfo) {
      localStorage.setItem(SKIPPED_VERSION_KEY, updater.updateInfo.version)
    }
    setShowUpdateModal(false)
  }, [updater.updateInfo])

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

  // 接收方提示：对端推过来时弹 toast，告诉用户"刚收到了什么"
  // 解的是之前"A 选笔记同步给 B，B 这边静默无感"的体验缺失
  useEffect(() => {
    type SyncReceivedEvent = {
      from: string
      received: number
      inserted: number
      updated: number
      conflicts: number
    }
    const unlistenPromise = listen<SyncReceivedEvent>('sync:received', (e) => {
      const { from, received, inserted, updated, conflicts } = e.payload
      const fromName = from?.trim() || '另一台设备'
      const local =
        inserted > 0 || updated > 0
          ? `本机新增 ${inserted}、更新 ${updated}`
          : '都已是最新（已忽略重复）'
      const base = `收到「${fromName}」推来 ${received} 条；${local}`
      const full =
        conflicts > 0 ? `${base}；${conflicts} 处冲突已存为「冲突副本」笔记` : base
      if (conflicts > 0) toast.warning(full, { duration: 8000 })
      else toast.success(full, { duration: 6000 })
    })
    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  // 接收方配对请求：对端首次连来同步时，本机弹配对码确认（与对端屏幕对数字）
  const [incomingPairing, setIncomingPairing] = useState<{ fingerprint: string; deviceName: string } | null>(null)
  useEffect(() => {
    type PairingReq = { fingerprint: string; deviceName: string; transport: string }
    const unlistenPromise = listen<PairingReq>('sync:pairing-request', (e) => {
      const { fingerprint, deviceName } = e.payload
      if (!fingerprint) return
      setIncomingPairing({ fingerprint, deviceName: deviceName || '未知设备' })
    })
    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  // 初始化默认数据并恢复未保存的数据
  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeDefaultNotes()
        // 回填多设备同步所需的 uuid（历史笔记），并迁移存量内嵌图片为附件
        await initDatabase()
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

    // view 切换先行：即使点的是当前已激活的笔记，从 dashboard/calendar 也要切回 inbox
    if (currentView === 'calendar' || currentView === 'dashboard') {
      setCurrentView('inbox')
    }

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
  }, [activeNoteId, localTitle, localContent, saveNoteById, hasUnsavedChanges, currentView])

  // 创建新笔记（空白）
  const handleCreateNote = async () => {
    try {
      if (activeNoteId !== null && hasUnsavedChanges()) {
        await saveNoteById(activeNoteId, localTitle, localContent)
      }

      const id = await createNote()
      setActiveNoteId(Number(id))
      setLocalTitle('无标题')
      setLocalContent('')
      // 清掉可能存在的搜索过滤（否则新空白笔记会被过滤掉、像「凭空消失」），
      // 并切到「全部笔记」——新建的空白笔记（非收藏/未删除/无标签）只可能出现在这里，
      // 留在收藏/废纸篓/某标签视图都会被过滤掉而看不见。
      setSearchQuery('')
      viewBeforeSearchRef.current = null
      setCurrentView('inbox')
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

  // 切换私有状态：设为私有的笔记不会通过同步发给任何对端
  const handleTogglePrivate = async (id: number) => {
    await noteOperations.togglePrivate(id)
    await refreshNotes()
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

  // 批量软删除（移到废纸篓）
  const handleDeleteNotes = async (ids: number[]) => {
    await deleteNotes(ids)
    if (activeNoteId !== null && ids.includes(activeNoteId)) setActiveNoteId(null)
  }

  // 批量恢复
  const handleRestoreNotes = async (ids: number[]) => {
    await restoreNotes(ids)
  }

  // 批量彻底删除
  const handlePermanentDeleteNotes = async (ids: number[]) => {
    await permanentDeleteNotes(ids)
    if (activeNoteId !== null && ids.includes(activeNoteId)) setActiveNoteId(null)
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

  // 从命令面板 / 仪表盘选择笔记：对全量笔记取，避免被当前视图或搜索过滤掉而点击无反应
  const handleCommandSelectNote = (id: number) => {
    const note = allNotes?.find((n) => n.id === id)
    if (note) {
      handleSelectNote(note)
    }
  }

  // 点击笔记内 note://<uuid> 引用：按 uuid 在全量笔记里定位并跳转
  const handleOpenNoteRef = useCallback((uuid: string) => {
    const note = allNotes?.find((n) => n.uuid === uuid)
    if (note) {
      handleSelectNote(note)
    } else {
      toast.info('引用的笔记不存在或尚未同步到本设备')
    }
  }, [allNotes, handleSelectNote])

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
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectNote={handleCommandSelectNote}
        onCreateNote={handleCreateNote}
      />

      {/* 启动时新版本提示 */}
      <UpdateAvailableModal
        open={showUpdateModal}
        updateInfo={updater.updateInfo}
        status={updater.status}
        progress={updater.progress}
        error={updater.error}
        onUpdate={updater.downloadAndInstall}
        onInstall={updater.installUpdate}
        onLater={() => setShowUpdateModal(false)}
        onSkip={handleSkipUpdate}
      />

      <div className="h-screen w-screen flex overflow-hidden bg-[#F9FBFC] dark:bg-[#0B0D11] transition-colors duration-300">
        {/* 左列：侧栏贯穿到顶，左上角是独立的 logo+名称展示区 */}
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          counts={counts}
          allTags={allTags}
          allNotes={allNotes || []}
          onOpenSettings={() => setCurrentView('settings')}
          sidebarState={sidebarState}
        />

        {/* 右列：顶栏（只压内容区）+ 内容 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TitleBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sidebarState={sidebarState}
            onToggleSidebar={cycleSidebar}
            showBrandFallback={sidebarState === 'hidden'}
          />

          <div className="flex-1 flex overflow-hidden">
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
                  onOpenNote={handleCommandSelectNote}
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
                  onClearSearch={() => {
                    // 列表内「清空搜索」：只清过滤、留在当前笔记列表，
                    // 不走标题栏 × 的「回到搜索前视图」逻辑，避免把人弹回仪表盘
                    setSearchQuery('')
                    viewBeforeSearchRef.current = null
                  }}
                  currentView={currentView}
                  notes={notes}
                  activeNoteId={activeNoteId}
                  onSelectNote={handleSelectNote}
                  onCreateNote={handleCreateNote}
                  onDeleteNote={handleDeleteNote}
                  onRestoreNote={handleRestoreNote}
                  onPermanentDelete={handlePermanentDelete}
                  onBatchDelete={handleDeleteNotes}
                  onBatchRestore={handleRestoreNotes}
                  onBatchPermanentDelete={handlePermanentDeleteNotes}
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
                    onTogglePrivate={handleTogglePrivate}
                    onToggleChat={toggleChat}
                    onCreateNote={handleCreateNote}
                    onContentInserted={handleContentInserted}
                    onSetReminder={handleSetReminder}
                    onClearReminder={handleClearReminder}
                    allNotes={allNotes || []}
                    onOpenNoteRef={handleOpenNoteRef}
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
      </div>

      {/* 提醒通知组件 */}
      <ReminderNotification
        reminders={calendar.upcomingReminders || []}
        onSelectNote={handleSelectNote}
        onDismiss={handleDismissReminder}
      />

      {/* 全局 Toast 容器 */}
      <ToastContainer toasts={toasts} removeToast={toast.remove} />

      {/* 接收方配对码确认（对端首次连来同步时弹出，与对端屏幕对数字） */}
      <PairingCodeModal
        open={incomingPairing !== null}
        onClose={() => setIncomingPairing(null)}
        deviceName={incomingPairing?.deviceName ?? ''}
        remoteFingerprint={incomingPairing?.fingerprint ?? ''}
        onConfirmed={() => {
          toast.success(`已与「${incomingPairing?.deviceName ?? '设备'}」建立信任，请让对方重新发起同步`)
        }}
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
