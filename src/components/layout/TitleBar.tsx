import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ThemeToggleButton } from '../common/ThemeToggleButton'
import { BrandLockup } from './BrandLockup'
import type { SidebarState } from './Sidebar'

interface TitleBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  sidebarState: SidebarState
  onToggleSidebar: () => void
  /** 侧栏隐藏时品牌区消失，由顶栏最左回落显示品牌 */
  showBrandFallback?: boolean
}

export function TitleBar({
  searchQuery,
  onSearchChange,
  sidebarState,
  onToggleSidebar,
  showBrandFallback,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const appWindow = getCurrentWindow()

  useEffect(() => {
    // 监听窗口最大化状态变化
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized()
      setIsMaximized(maximized)
    })

    // 初始化时检查状态
    appWindow.isMaximized().then(setIsMaximized)

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [appWindow])

  const handleMinimize = () => {
    appWindow.minimize()
  }

  const handleMaximize = () => {
    appWindow.toggleMaximize()
  }

  // 关闭按钮改为隐藏窗口到系统托盘
  const handleClose = () => {
    appWindow.hide()
  }

  return (
    <div
      data-tauri-drag-region
      className="h-12 flex-shrink-0 flex items-center select-none bg-[#F9FBFC] dark:bg-[#0B0D11] border-b border-black/[0.03] dark:border-white/[0.06] transition-colors duration-300"
    >
      {/* 侧栏隐藏时，品牌回落到顶栏最左 */}
      {showBrandFallback && <BrandLockup />}

      {/* 侧栏收起/展开（三态循环，移到顶栏最左；侧栏隐藏时也能在此唤回） */}
      <button
        onClick={onToggleSidebar}
        className="ml-2 flex-shrink-0 p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-150"
        title={
          sidebarState === 'expanded'
            ? '收起侧栏 (Ctrl+\\)'
            : sidebarState === 'collapsed'
              ? '隐藏侧栏 (Ctrl+\\)'
              : '显示侧栏 (Ctrl+\\)'
        }
      >
        {sidebarState === 'expanded' ? (
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} />
        )}
      </button>

      {/* 沉浸式搜索框（置顶）。
          搜索区不带 data-tauri-drag-region，且显式拦截 mousedown，
          确保点击聚焦 / 拖选文字不会被窗口拖拽吞掉。 */}
      <div
        className="flex items-center min-w-0 px-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 w-64 min-w-0 px-3 py-1.5 bg-black/[0.03] dark:bg-white/[0.04] border border-transparent rounded-full text-[13px] text-slate-400 focus-within:bg-white dark:focus-within:bg-white/[0.06] focus-within:border-[#5E6AD2]/40 transition-colors duration-200">
          <Search className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索笔记..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="p-0.5 flex-shrink-0 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] btn-press"
              title="清空搜索"
            >
              <X className="h-3 w-3 text-slate-400" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* 中间可拖动区域 */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* 右侧 - 主题切换 + 窗口控制按钮 */}
      <div className="flex items-center h-full flex-shrink-0">
        {/* 深色 / 浅色切换（标题栏内缩小一档，约 62×28，不喧宾夺主） */}
        <div className="px-3 flex items-center">
          <ThemeToggleButton size="11px" />
        </div>

        {/* 分隔线 */}
        <div className="h-5 w-px bg-black/[0.06] dark:bg-white/[0.08]" />

        {/* 最小化按钮 */}
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-150"
          title="最小化"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>

        {/* 最大化/还原按钮 */}
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-150"
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <Copy className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <Square className="h-3 w-3" strokeWidth={1.5} />
          )}
        </button>

        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-red-500 hover:text-white transition-colors duration-150"
          title="关闭"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
