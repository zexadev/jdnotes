import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { initializeDefaultNotes, initDatabase, noteOperations, formatDateKey, type Note } from './lib/db'
import { useAutoSave, useNotes, useReminders, recoverPendingSaves } from './hooks'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { CommandMenu } from './components/modals/CommandMenu'
import { ContextMenu, type ContextMenuItem } from './components/common/ContextMenu'
import { Copy, Scissors, ClipboardPaste, TextSelect } from 'lucide-react'
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
import { isMobilePlatform, useIsNarrow } from './lib/platform'
import { pushLayer, closeLayer } from './lib/backStack'

// 视图类型
export type ViewType = 'dashboard' | 'inbox' | 'favorites' | 'trash' | 'calendar' | 'settings' | `tag-${string}`

// 侧栏状态循环顺序
const SIDEBAR_CYCLE: SidebarState[] = ['expanded', 'collapsed', 'hidden']

// 顶层视图切换统一过渡：popLayout 交叠淡切（旧页淡出与新页淡入同时进行，无空白帧），
// 入场轻微上移；四个视图共用同一组参数，切到哪里手感都一致
const VIEW_MOTION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.1 } },
  transition: { duration: 0.16, ease: 'easeOut' as const },
}

// 跳过版本的 localStorage key
const SKIPPED_VERSION_KEY = 'jdnotes-skipped-version'

// Android 状态栏/手势条由页面自己留白（变量由 MainActivity 写入，桌面为 0）：
// 留白区画的是页面自己的背景，切主题时才能和内容同一帧变色
const SAFE_AREA_PADDING = {
  paddingTop: 'var(--safe-area-top, 0px)',
  paddingBottom: 'var(--safe-area-bottom, 0px)',
} as const

function App() {
  const [isReady, setIsReady] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [localTitle, setLocalTitle] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  // 日历聚焦日：概览热力图点格带过来；常规入口（侧栏/概览导航）进日历前清掉，避免停在旧日期
  const [calendarFocusDate, setCalendarFocusDate] = useState<Date | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [contentToInsert, setContentToInsert] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [toasts, setToasts] = useState(toast.getToasts())

  // 窄屏（手机）：侧栏变抽屉、列表与编辑器堆叠、AI 侧栏变全屏层；每一层都挂到返回栈上接 Android 返回手势
  const isNarrow = useIsNarrow()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openDrawer = useCallback(() => {
    setDrawerOpen(true)
    pushLayer(() => setDrawerOpen(false))
  }, [])

  // 侧栏状态（从 localStorage 恢复）
  const [sidebarState, setSidebarState] = useState<SidebarState>(() => {
    const saved = localStorage.getItem('jdnotes-sidebar-state')
    if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') {
      return saved
    }
    return 'expanded'
  })

  // 常规视图切换（侧栏/概览导航共用）：清掉热力图带来的日历聚焦日
  const handleViewChange = useCallback((view: ViewType) => {
    setCalendarFocusDate(null)
    setCurrentView(view)
  }, [])

  // 概览热力图点格直达日历该日
  const handleOpenCalendarDate = useCallback((date: Date) => {
    setCalendarFocusDate(date)
    setCurrentView('calendar')
  }, [])

  // 循环切换侧栏状态（展开 → 收起 → 隐藏 → …）并持久化；Ctrl+\ 与顶栏按钮共用。
  // 按钮图标按状态标注"下一步动作"（收起态是虚线面板=再点隐藏），见 TitleBar
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
      // 走 handleViewChange 而非裸 setCurrentView：恢复目标可能是日历，须同步清掉热力图带来的聚焦日
      if (currentViewRef.current === 'inbox') handleViewChange(prev)
    }
  }, [handleViewChange])

  // 沉浸模式：窗口全屏 + 隐藏侧栏/顶栏/笔记列表，只留内容区；F11 切换
  const [isImmersive, setIsImmersive] = useState(false)
  const toggleImmersive = useCallback(() => {
    // 手机没有窗口全屏 API，也没有可收的侧栏/顶栏
    if (isMobilePlatform) return
    setIsImmersive((prev) => {
      const next = !prev
      // UI 先切换，窗口全屏异步跟上；失败（如权限缺失）时回滚，避免"全屏没进去但界面全没了"
      getCurrentWindow()
        .setFullscreen(next)
        .catch((e) => {
          console.error('切换全屏失败:', e)
          setIsImmersive(prev)
        })
      return next
    })
  }, [])

  // Ctrl+\ 循环侧栏、F11 沉浸模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        cycleSidebar()
      }
      if (e.key === 'F11') {
        e.preventDefault()
        toggleImmersive()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cycleSidebar, toggleImmersive])

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

  // 全局提醒引擎（唯一实例：轮询 + 精确定时器 + 通知数据源）
  const { upcomingReminders, refreshReminders } = useReminders()

  // 设置笔记提醒
  const handleSetReminder = useCallback(async (noteId: number, reminderDate: Date) => {
    await noteOperations.setReminder(noteId, reminderDate)
    // 刷新笔记列表以更新 activeNote 的提醒状态
    await refreshNotes()
    // 刷新提醒列表
    await refreshReminders()
  }, [refreshNotes, refreshReminders])

  // 清除笔记提醒
  const handleClearReminder = useCallback(async (noteId: number) => {
    await noteOperations.clearReminder(noteId)
    // 刷新笔记列表以更新 activeNote 的提醒状态
    await refreshNotes()
    // 刷新提醒列表
    await refreshReminders()
  }, [refreshNotes, refreshReminders])

  // 提醒通知关闭时清除提醒
  const handleDismissReminder = useCallback(async (noteId: number) => {
    await noteOperations.clearReminder(noteId)
    // 刷新笔记列表以更新工具栏的提醒按钮状态
    await refreshNotes()
    // 刷新提醒列表
    await refreshReminders()
  }, [refreshNotes, refreshReminders])

  // 切换 AI 聊天侧栏；窄屏下它是全屏层，开关都经返回栈，返回手势才关得掉它
  const toggleChat = useCallback(() => {
    if (isNarrow) {
      if (isChatOpen) closeLayer()
      else {
        pushLayer(() => setIsChatOpen(false))
        setIsChatOpen(true)
      }
      return
    }
    setIsChatOpen((prev) => !prev)
  }, [isNarrow, isChatOpen])
  const closeChat = useCallback(() => {
    if (isNarrow) closeLayer()
    else setIsChatOpen(false)
  }, [isNarrow])

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

  // 右键菜单：网页原生菜单一律禁掉（桌面软件不该出浏览器菜单），换应用自绘菜单——
  // 可编辑区出 复制/剪切/粘贴/全选，任意区域有选区出 复制，空白处什么都不出。
  // 没有右键复制是"复制了剪贴板却没有"投诉的元凶（其实根本没复制成）
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

  useEffect(() => {
    const pasteInto = async (editableRoot: HTMLElement | null, inputEl: HTMLInputElement | HTMLTextAreaElement | null) => {
      try {
        const text = await navigator.clipboard.readText()
        if (!text) return
        if (inputEl) {
          inputEl.focus()
          document.execCommand('insertText', false, text)
        } else if (editableRoot) {
          editableRoot.focus()
          // 走完整粘贴管线（代码围栏识别、markdown 解析都在里面）
          const dt = new DataTransfer()
          dt.setData('text/plain', text)
          const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
          Object.defineProperty(ev, 'clipboardData', { value: dt })
          editableRoot.dispatchEvent(ev)
        }
      } catch {
        toast.error('无法读取剪贴板，请使用 Ctrl+V 粘贴')
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      // 触屏长按也会派发 contextmenu：不拦，让系统选区工具条（复制/粘贴/全选）正常出来
      if (isMobilePlatform) return
      e.preventDefault()
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      const selText = window.getSelection()?.toString() ?? ''
      const inputEl = t.closest('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
      const editableRoot = inputEl ? null : (t.closest('.ProseMirror, [contenteditable="true"]') as HTMLElement | null)

      const items: ContextMenuItem[] = []
      if (inputEl || editableRoot) {
        const hasSel = inputEl
          ? inputEl.selectionStart !== inputEl.selectionEnd
          : selText.length > 0
        items.push(
          { icon: Copy, label: '复制', hint: 'Ctrl+C', disabled: !hasSel, onSelect: () => document.execCommand('copy') },
          { icon: Scissors, label: '剪切', hint: 'Ctrl+X', disabled: !hasSel, onSelect: () => document.execCommand('cut') },
          { icon: ClipboardPaste, label: '粘贴', hint: 'Ctrl+V', onSelect: () => void pasteInto(editableRoot, inputEl) },
          {
            icon: TextSelect,
            label: '全选',
            hint: 'Ctrl+A',
            onSelect: () => {
              if (inputEl) inputEl.select()
              else {
                editableRoot?.focus()
                document.execCommand('selectAll')
              }
            },
          },
        )
      } else if (selText) {
        items.push({ icon: Copy, label: '复制', hint: 'Ctrl+C', onSelect: () => document.execCommand('copy') })
      }
      if (items.length > 0) setCtxMenu({ x: e.clientX, y: e.clientY, items })
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
        // 手机不种欢迎笔记：两条 seed 用的是固定 uuid，桌面早已把它们删掉或改过，
        // 首次同步时同 uuid 相撞——桌面的墓碑只拦「本地不存在」的 uuid，手机本地已有就会让
        // 桌面删掉的欢迎笔记复活；桌面改过的则各自 base=None 直接出冲突副本。
        // 手机的内容靠同步拿，空库由列表的空态引导去配对；欢迎笔记里的 Ctrl+K/Ctrl+L 也全是桌面话
        if (!isMobilePlatform) {
          await initializeDefaultNotes()
        }
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

  // 窄屏：打开笔记=堆一层（编辑器全屏），返回手势与「返回」按钮都经 closeLayer 弹回列表
  const noteLayerRef = useRef(false)
  useEffect(() => {
    if (!isNarrow) return
    if (activeNoteId !== null && !noteLayerRef.current) {
      noteLayerRef.current = true
      pushLayer(() => {
        noteLayerRef.current = false
        setActiveNoteId(null)
      })
    } else if (activeNoteId === null && noteLayerRef.current) {
      // 经删除等别的路径关掉的：把历史里那一层也弹掉，回调里的置空只是重复一次
      closeLayer()
    }
  }, [activeNoteId, isNarrow])

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

  // 在指定日期新建笔记（日历页入口）：非今天则 createdAt 定到该日正午——
  // 取正午不取零点，避免时区/夏令时边界把日期挤到前一天
  const handleCreateNoteAt = async (date: Date) => {
    try {
      if (activeNoteId !== null && hasUnsavedChanges()) {
        await saveNoteById(activeNoteId, localTitle, localContent)
      }

      const id = await createNote()
      if (formatDateKey(date) !== formatDateKey(new Date())) {
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
        await noteOperations.updateCreatedAt(Number(id), target)
        await refreshNotes()
      }
      setActiveNoteId(Number(id))
      setLocalTitle('无标题')
      setLocalContent('')
      // 同 handleCreateNote：清搜索并切到「全部笔记」，防新空白笔记被过滤掉
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

  // 点击字面 [[标题]] 引用：按标题在全量笔记里精确匹配并跳转（Obsidian 风格）
  const handleOpenNoteByTitle = useCallback((title: string) => {
    const t = title.trim()
    const note = allNotes?.find((n) => n.title === t)
    if (note) {
      handleSelectNote(note)
    } else {
      toast.info(`未找到标题为「${t}」的笔记`)
    }
  }, [allNotes, handleSelectNote])

  // 启动加载状态
  if (!isReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FBFC] dark:bg-[#0B0D11] transition-colors duration-300" style={SAFE_AREA_PADDING}>
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

      <div className="h-screen w-screen flex overflow-hidden bg-[#F9FBFC] dark:bg-[#0B0D11] transition-colors duration-300" style={SAFE_AREA_PADDING}>
        {/* 左列：侧栏贯穿到顶，左上角是独立的 logo+名称展示区；沉浸模式整列收拢 */}
        <AnimatePresence initial={false}>
          {!isImmersive && !isNarrow && (
            <motion.div
              key="app-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="h-full flex-shrink-0 overflow-hidden flex"
            >
              <Sidebar
                currentView={currentView}
                onViewChange={handleViewChange}
                counts={counts}
                allTags={allTags}
                allNotes={allNotes || []}
                onOpenSettings={() => setCurrentView('settings')}
                sidebarState={sidebarState}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 窄屏：侧栏改为从左滑入的抽屉，选中任一项即收回；背景点击/返回手势都经返回栈关闭 */}
        <AnimatePresence>
          {isNarrow && drawerOpen && (
            <motion.div
              key="app-drawer"
              className="fixed inset-0 z-40 flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="absolute inset-0 bg-black/40" onClick={closeLayer} />
              <motion.div
                // sidebar-gradient 是半透明渐变（设计上垫在 app 底色上），抽屉浮在内容之上必须自带不透明底
                className="relative h-full flex shadow-2xl bg-[#F9FBFC] dark:bg-[#0B0D11]"
                style={SAFE_AREA_PADDING}
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              >
                <Sidebar
                  currentView={currentView}
                  onViewChange={(view) => {
                    handleViewChange(view)
                    closeLayer()
                  }}
                  counts={counts}
                  allTags={allTags}
                  allNotes={allNotes || []}
                  onOpenSettings={() => {
                    setCurrentView('settings')
                    closeLayer()
                  }}
                  sidebarState="expanded"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 右列：顶栏（只压内容区）+ 内容 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <AnimatePresence initial={false}>
            {!isImmersive && (
              <motion.div
                key="app-titlebar"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="flex-shrink-0 overflow-hidden"
              >
                <TitleBar
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  sidebarState={sidebarState}
                  onToggleSidebar={isNarrow ? openDrawer : cycleSidebar}
                  showBrandFallback={sidebarState === 'hidden'}
                  compact={isNarrow}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex-1 flex overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
            {/* Dashboard 页面 */}
            {currentView === 'dashboard' ? (
              <motion.div
                key="dashboard"
                {...VIEW_MOTION}
                className="flex-1 h-full"
              >
                <DashboardPage
                  allNotes={allNotes || []}
                  counts={counts}
                  onNavigate={handleViewChange}
                  onCreateNote={handleCreateNote}
                  onOpenNote={handleCommandSelectNote}
                  onOpenCalendarDate={handleOpenCalendarDate}
                />
              </motion.div>
            ) : currentView === 'settings' ? (
              <motion.div
                key="settings"
                {...VIEW_MOTION}
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
                {...VIEW_MOTION}
                className="flex-1 h-full overflow-hidden"
              >
                <CalendarView
                  onSelectNote={handleSelectNote}
                  onCreateNote={handleCreateNoteAt}
                  initialDate={calendarFocusDate ?? undefined}
                />
              </motion.div>
            ) : (
              <motion.div
                key="notes"
                {...VIEW_MOTION}
                className="flex-1 flex h-full overflow-hidden"
              >
                {/* 窄屏：列表与编辑器堆叠，打开笔记时列表让位。不卸载只隐藏——
                    卸载再挂载上百张卡片一次 150ms 左右，隐藏/显示零成本，还保住列表滚动位置；
                    也不走宽度动画（width auto↔0 每帧重排上百张卡片，是手机上进出笔记发滞的主因） */}
                {isNarrow && (
                  <div className={`h-full flex-1 min-w-0 overflow-hidden ${activeNoteId !== null ? 'hidden' : 'flex'}`}>
                    <NoteList
                      searchQuery={searchQuery}
                      onClearSearch={() => {
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
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {!isImmersive && !isNarrow && (
                    <motion.div
                      key="app-notelist"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full flex-shrink-0 overflow-hidden flex"
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
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 右侧编辑器 + AI 侧栏；窄屏下没打开笔记时不渲染，列表独占 */}
                {(!isNarrow || activeNoteId !== null) && (
                <div className="flex-1 flex h-full overflow-hidden min-w-0">
                  <MainContent
                    onBack={isNarrow ? closeLayer : undefined}
                    onDeleteNote={isNarrow ? handleDeleteNote : undefined}
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
                    onOpenNoteByTitle={handleOpenNoteByTitle}
                    onOpenNote={handleCommandSelectNote}
                  />

                  {/* AI 聊天侧栏（窄屏为全屏层） */}
                  <AIChatSidebar
                    isOpen={isChatOpen}
                    onClose={closeChat}
                    noteId={activeNoteId}
                    noteTitle={localTitle}
                    noteContent={localContent}
                    onInsertToNote={handleInsertToNote}
                    fullScreen={isNarrow}
                  />
                </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 提醒通知组件 */}
      <ReminderNotification
        reminders={upcomingReminders}
        onSelectNote={handleSelectNote}
        onDismiss={handleDismissReminder}
      />

      {/* 全局 Toast 容器 */}
      <ToastContainer toasts={toasts} removeToast={toast.remove} />

      {/* 应用自绘右键菜单 */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}

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
