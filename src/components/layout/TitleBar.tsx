import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function TitleBar() {
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
      className="h-9 flex items-center justify-between select-none bg-[#F9FBFC] dark:bg-[#0B0D11] border-b border-black/[0.03] dark:border-white/[0.06] transition-colors duration-300"
    >
      {/* 左侧 - 应用图标和标题 */}
      <div data-tauri-drag-region className="flex items-center gap-2 px-3 h-full">
        <img 
          src="/app-icon.png" 
          alt="JD Notes" 
          className="h-4 w-4 rounded pointer-events-none"
          draggable={false}
        />
        <span 
          data-tauri-drag-region
          className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-tight"
        >
          JD Notes
        </span>
      </div>

      {/* 中间可拖动区域 */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* 右侧 - 窗口控制按钮 */}
      <div className="flex items-center h-full">
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
