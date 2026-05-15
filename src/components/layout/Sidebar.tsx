import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Star,
  Trash2,
  Search,
  Tag,
  X,
  Settings,
  Calendar,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { SidebarItem } from '../common/SidebarItem'
import { ThemeToggleButton } from '../common/ThemeToggleButton'

export type SidebarState = 'expanded' | 'collapsed' | 'hidden'

interface SidebarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  currentView: string
  onViewChange: (view: any) => void
  counts: {
    inbox: number
    favorites: number
    trash: number
  }
  allTags: string[]
  allNotes: any[]
  onOpenSettings: () => void
  sidebarState: SidebarState
  onSidebarStateChange: (state: SidebarState) => void
}

export function Sidebar({
  searchQuery,
  onSearchChange,
  currentView,
  onViewChange,
  counts,
  allTags,
  allNotes,
  onOpenSettings,
  sidebarState,
  onSidebarStateChange,
}: SidebarProps) {
  const isCollapsed = sidebarState === 'collapsed'
  const isHidden = sidebarState === 'hidden'

  const handleToggle = () => {
    if (sidebarState === 'expanded') {
      onSidebarStateChange('collapsed')
    } else if (sidebarState === 'collapsed') {
      onSidebarStateChange('hidden')
    } else {
      onSidebarStateChange('expanded')
    }
  }

  // Tag tooltip state for collapsed mode
  const [tagTooltip, setTagTooltip] = useState<string | null>(null)

  const sidebarWidth = isHidden ? 0 : isCollapsed ? 64 : 260

  return (
    <>
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="sidebar-gradient border-r border-black/[0.03] dark:border-white/[0.06] flex flex-col transition-colors duration-300 overflow-hidden flex-shrink-0"
      >
        {/* Logo, toggle and theme switch */}
        <div className="p-3 border-b border-black/[0.03] dark:border-white/[0.06]">
          <div className={`flex items-center px-2 py-1.5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <img src="/app-icon.png" alt="JD" className="h-6 w-6 rounded-md flex-shrink-0" />
                <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">
                  JD Notes
                </span>
              </div>
            )}
            <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-1'}`}>
              {!isCollapsed && <ThemeToggleButton />}
              <button
                onClick={handleToggle}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors duration-150"
                title={isCollapsed ? '展开侧栏' : '收起侧栏'}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search box - hidden in collapsed mode */}
        {!isCollapsed && (
          <div className="p-3">
            <div className="flex items-center gap-2 w-full px-3 py-2 bg-white/80 dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.06] rounded-lg text-[13px] text-slate-400 focus-within:border-[#5E6AD2]/30 transition-colors duration-200">
              <Search className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="搜索笔记..."
                className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="p-0.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded btn-press"
                >
                  <X className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation links */}
        <nav className={`space-y-1 ${isCollapsed ? 'px-2 mt-2' : 'px-3'}`}>
          <SidebarItem
            icon={LayoutDashboard}
            label="数据概览"
            active={currentView === 'dashboard'}
            collapsed={isCollapsed}
            onClick={() => onViewChange('dashboard')}
          />
          <SidebarItem
            icon={FileText}
            label="全部笔记"
            active={currentView === 'inbox'}
            count={counts.inbox}
            collapsed={isCollapsed}
            onClick={() => onViewChange('inbox')}
          />
          <SidebarItem
            icon={Star}
            label="收藏"
            active={currentView === 'favorites'}
            count={counts.favorites}
            collapsed={isCollapsed}
            onClick={() => onViewChange('favorites')}
          />
          <SidebarItem
            icon={Trash2}
            label="废纸篓"
            active={currentView === 'trash'}
            count={counts.trash}
            collapsed={isCollapsed}
            onClick={() => onViewChange('trash')}
          />
          <SidebarItem
            icon={Calendar}
            label="日历"
            active={currentView === 'calendar'}
            collapsed={isCollapsed}
            onClick={() => onViewChange('calendar')}
          />
        </nav>

        {/* Tags section - hidden in collapsed mode */}
        {!isCollapsed && (
          <div className="mt-6 px-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                标签
              </span>
            </div>
            <div className="space-y-1">
              {allTags.length === 0 ? (
                <p className="text-[12px] text-slate-400 dark:text-slate-500 px-3 py-2">暂无标签</p>
              ) : (
                allTags.map((tag) => {
                  const tagCount =
                    allNotes?.filter(
                      (n) => n.isDeleted === 0 && n.tags?.includes(tag)
                    ).length || 0
                  const isActive = currentView === `tag-${tag}`
                  return (
                    <button
                      key={tag}
                      onClick={() => onViewChange(`tag-${tag}`)}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[13px] transition-colors duration-150 btn-press ${
                        isActive
                          ? 'bg-white dark:bg-white/[0.03] text-slate-900 dark:text-slate-100 font-medium shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      {isActive && <span className="w-0.5 h-3.5 bg-[#5E6AD2] rounded-full -ml-1 mr-0.5" />}
                      <Tag className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span>{tag}</span>
                      <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                        {tagCount}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Collapsed mode: tag icons with tooltips */}
        {isCollapsed && allTags.length > 0 && (
          <div className="mt-4 px-2 flex-1 min-h-0 overflow-y-auto space-y-1">
            {allTags.map((tag) => {
              const tagCount =
                allNotes?.filter(
                  (n) => n.isDeleted === 0 && n.tags?.includes(tag)
                ).length || 0
              const isActive = currentView === `tag-${tag}`
              return (
                <div key={tag} className="relative">
                  <button
                    onClick={() => onViewChange(`tag-${tag}`)}
                    onMouseEnter={() => setTagTooltip(tag)}
                    onMouseLeave={() => setTagTooltip(null)}
                    className={`flex items-center justify-center w-full py-2 rounded-lg text-[13px] transition-colors duration-150 btn-press ${
                      isActive
                        ? 'bg-white dark:bg-white/[0.03] text-[#5E6AD2] font-medium shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} />
                  </button>
                  {tagTooltip === tag && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-[12px] rounded-md shadow-lg whitespace-nowrap pointer-events-none">
                      {tag}
                      {tagCount > 0 && (
                        <span className="ml-1.5 text-slate-300">({tagCount})</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Settings button - bottom */}
        <div className={`border-t border-black/[0.03] dark:border-white/[0.06] ${isCollapsed ? 'p-2' : 'p-3'}`}>
          {isCollapsed ? (
            <SidebarItem
              icon={Settings}
              label="设置"
              collapsed={true}
              onClick={onOpenSettings}
            />
          ) : (
            <>
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-3 w-full px-3 py-2 text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/[0.02] rounded-lg transition-colors duration-200 btn-press"
              >
                <Settings className="h-4 w-4" strokeWidth={1.5} />
                <span>设置</span>
              </button>
              <p className="text-[10px] text-slate-300 dark:text-slate-700 text-center mt-3 italic tracking-wide">
                Think is Water
              </p>
            </>
          )}
        </div>
      </motion.aside>

      {/* Floating button to show sidebar when hidden */}
      {isHidden && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          onClick={() => onSidebarStateChange('expanded')}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 p-1.5 bg-white dark:bg-[#1a1d24] border border-black/[0.06] dark:border-white/[0.08] rounded-r-lg shadow-md hover:bg-slate-50 dark:hover:bg-[#22252d] transition-colors duration-150"
          title="显示侧栏 (Ctrl+\)"
        >
          <PanelLeftOpen className="h-4 w-4 text-slate-500 dark:text-slate-400" strokeWidth={1.5} />
        </motion.button>
      )}
    </>
  )
}
