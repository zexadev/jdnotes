import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Star,
  Trash2,
  Tag,
  Settings,
  Calendar,
  LayoutDashboard,
  ChevronDown,
  Search,
  X,
} from 'lucide-react'
import { SidebarItem } from '../common/SidebarItem'
import { tagColor } from '../../lib/tagColor'
import type { Note } from '../../lib/db'
import type { ViewType } from '../../App'

export type SidebarState = 'expanded' | 'collapsed' | 'hidden'

interface SidebarProps {
  currentView: string
  onViewChange: (view: ViewType) => void
  counts: {
    inbox: number
    favorites: number
    trash: number
  }
  allTags: string[]
  allNotes: Note[]
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

  // 标签区：按使用数排序，默认只显示 Top N（标签一多平铺列表就失控），
  // 展开显示全部并提供筛选；当前激活的标签即使不在 Top N 也钉进列表
  const TOP_TAGS = 8
  const [showAllTags, setShowAllTags] = useState(false)
  const [tagFilter, setTagFilter] = useState('')

  const tagStats = useMemo(() => {
    return allTags
      .map((tag) => ({
        tag,
        count: allNotes?.filter((n) => n.isDeleted === 0 && n.tags?.includes(tag)).length || 0,
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hans-CN'))
  }, [allTags, allNotes])

  const activeTag = currentView.startsWith('tag-') ? currentView.slice(4) : null

  const visibleTags = useMemo(() => {
    if (showAllTags) {
      const q = tagFilter.trim().toLowerCase()
      return q ? tagStats.filter((t) => t.tag.toLowerCase().includes(q)) : tagStats
    }
    const top = tagStats.slice(0, TOP_TAGS)
    if (activeTag && !top.some((t) => t.tag === activeTag)) {
      const found = tagStats.find((t) => t.tag === activeTag)
      if (found) return [...top, found]
    }
    return top
  }, [tagStats, showAllTags, tagFilter, activeTag])

  // 收起态窄条同样只显示 Top N（+激活钉住）
  const collapsedTags = useMemo(() => {
    const top = tagStats.slice(0, TOP_TAGS)
    if (activeTag && !top.some((t) => t.tag === activeTag)) {
      const found = tagStats.find((t) => t.tag === activeTag)
      if (found) return [...top, found]
    }
    return top
  }, [tagStats, activeTag])

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
        className="h-[88px] flex-shrink-0 flex items-center justify-center gap-3 overflow-hidden border-b border-black/[0.03] dark:border-white/[0.06]"
      >
        <img
          src="/app-icon.png"
          alt="Lapis"
          className={`${isCollapsed ? 'h-8 w-8' : 'h-10 w-10'} rounded-lg pointer-events-none flex-shrink-0`}
          draggable={false}
        />
        {!isCollapsed && (
          <span
            data-tauri-drag-region
            className="text-[22px] font-semibold text-slate-800 dark:text-slate-100 tracking-[0.08em] leading-none whitespace-nowrap"
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
          <div className="mt-6 px-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 flex-shrink-0 px-1">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                标签
              </span>
              {allTags.length > 0 && (
                <span className="text-[10px] tabular-nums text-slate-300 dark:text-slate-600">{allTags.length}</span>
              )}
            </div>

            {/* 展开全部时提供筛选 */}
            {showAllTags && allTags.length > TOP_TAGS && (
              <div className="relative mb-2 flex-shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" strokeWidth={1.5} />
                <input
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && tagFilter) {
                      e.stopPropagation()
                      setTagFilter('')
                    }
                  }}
                  placeholder="筛选标签…"
                  className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-lg bg-black/[0.04] dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-1 focus:ring-[#5E6AD2]/40 transition-shadow"
                />
                {tagFilter && (
                  <button
                    onClick={() => setTagFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1 flex-1 min-h-0 overflow-y-auto">
              {allTags.length === 0 ? (
                <p className="text-[12px] text-slate-400 dark:text-slate-500 px-3 py-2">暂无标签</p>
              ) : visibleTags.length === 0 ? (
                <p className="text-[12px] text-slate-400 dark:text-slate-500 px-3 py-2">没有匹配的标签</p>
              ) : (
                visibleTags.map(({ tag, count }) => {
                  const isActive = currentView === `tag-${tag}`
                  return (
                    <button
                      key={tag}
                      onClick={() => onViewChange(`tag-${tag}`)}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-[13px] transition-colors duration-150 btn-press ${
                        isActive
                          ? 'bg-[#5E6AD2]/10 text-[#5E6AD2] font-medium'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      {isActive && <span className="w-[3px] h-3.5 bg-[#5E6AD2] rounded-full -ml-1 mr-0.5 flex-shrink-0" />}
                      <Tag className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} style={{ color: tagColor(tag).base }} />
                      <span className="truncate">{tag}</span>
                      <span className={`ml-auto text-[11px] tabular-nums flex-shrink-0 ${isActive ? 'text-[#5E6AD2]/70' : 'text-slate-400 dark:text-slate-500'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {/* Top N 与全部之间切换 */}
            {allTags.length > TOP_TAGS && (
              <button
                onClick={() => {
                  setShowAllTags(!showAllTags)
                  setTagFilter('')
                }}
                className="flex-shrink-0 flex items-center justify-center gap-1 w-full mt-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.07] hover:text-[#5E6AD2] hover:border-[#5E6AD2]/30 hover:bg-[#5E6AD2]/5 transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${showAllTags ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                {showAllTags ? '收起' : `显示全部 ${allTags.length} 个`}
              </button>
            )}
          </div>
        )}

        {/* Collapsed mode: tag icons with tooltips */}
        {isCollapsed && allTags.length > 0 && (
          <div className="mt-4 px-2 flex-1 min-h-0 overflow-y-auto space-y-1">
            {collapsedTags.map(({ tag, count: tagCount }) => {
              const isActive = currentView === `tag-${tag}`
              return (
                <div key={tag} className="relative">
                  <button
                    onClick={() => onViewChange(`tag-${tag}`)}
                    onMouseEnter={() => setTagTooltip(tag)}
                    onMouseLeave={() => setTagTooltip(null)}
                    className={`flex items-center justify-center w-full py-2 rounded-lg text-[13px] transition-colors duration-150 btn-press ${
                      isActive
                        ? 'bg-[#5E6AD2]/10 text-[#5E6AD2] font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} style={{ color: tagColor(tag).base }} />
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
                Clarity, kept.
              </p>
            </>
          )}
        </div>
      </motion.aside>
  )
}
