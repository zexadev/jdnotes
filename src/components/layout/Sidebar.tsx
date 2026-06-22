import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Star,
  Trash2,
  Tag,
  Settings,
  Calendar,
  LayoutDashboard,
} from 'lucide-react'
import { SidebarItem } from '../common/SidebarItem'

export type SidebarState = 'expanded' | 'collapsed' | 'hidden'

interface SidebarProps {
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
}

export function Sidebar({
  currentView,
  onViewChange,
  counts,
  allTags,
  allNotes,
  onOpenSettings,
  sidebarState,
}: SidebarProps) {
  const isCollapsed = sidebarState === 'collapsed'

  // Tag tooltip state for collapsed mode
  const [tagTooltip, setTagTooltip] = useState<string | null>(null)

  const sidebarWidth = sidebarState === 'hidden' ? 0 : isCollapsed ? 64 : 260

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="sidebar-gradient border-r border-black/[0.03] dark:border-white/[0.06] flex flex-col transition-colors duration-300 overflow-hidden flex-shrink-0"
    >
      {/* 左上角品牌展示区：贯穿到顶、比顶栏高的独立 logo+名称块 */}
      <div
        data-tauri-drag-region
        className={`h-[88px] flex-shrink-0 flex items-center overflow-hidden border-b border-black/[0.03] dark:border-white/[0.06] ${
          isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-5'
        }`}
      >
        <img
          src="/app-icon.png"
          alt="Lapis"
          className={`${isCollapsed ? 'h-6 w-6' : 'h-7 w-7'} rounded-lg pointer-events-none flex-shrink-0`}
          draggable={false}
        />
        {!isCollapsed && (
          <span
            data-tauri-drag-region
            className="text-[17px] font-semibold text-slate-800 dark:text-slate-100 tracking-[-0.01em] leading-none whitespace-nowrap"
          >
            Lapis
          </span>
        )}
      </div>

      {/* Navigation links */}
      <nav className={`space-y-1 ${isCollapsed ? 'px-2 mt-3' : 'px-3 mt-3'}`}>
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
  )
}
