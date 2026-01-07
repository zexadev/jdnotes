import {
  FileText,
  Star,
  Trash2,
  Search,
  Tag,
  X,
  Settings,
  Calendar,
} from 'lucide-react'
import { SidebarItem } from '../common/SidebarItem'
import { ThemeToggleButton } from '../common/ThemeToggleButton'

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
}: SidebarProps) {
  return (
    <aside className="w-[260px] sidebar-gradient border-r border-black/[0.03] dark:border-white/[0.06] flex flex-col transition-colors duration-300">
      {/* Logo 和主题切换 */}
      <div className="p-3 border-b border-black/[0.03] dark:border-white/[0.06]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2">
            <img src="/app-icon.png" alt="JD" className="h-6 w-6 rounded-md" />
            <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100 tracking-tight">
              JD Notes
            </span>
          </div>
          <ThemeToggleButton />
        </div>
      </div>

      {/* 搜索输入框 */}
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

      {/* 导航链接 */}
      <nav className="px-3 space-y-1">
        <SidebarItem
          icon={FileText}
          label="全部笔记"
          active={currentView === 'inbox'}
          count={counts.inbox}
          onClick={() => onViewChange('inbox')}
        />
        <SidebarItem
          icon={Star}
          label="收藏"
          active={currentView === 'favorites'}
          count={counts.favorites}
          onClick={() => onViewChange('favorites')}
        />
        <SidebarItem
          icon={Trash2}
          label="废纸篓"
          active={currentView === 'trash'}
          count={counts.trash}
          onClick={() => onViewChange('trash')}
        />
        <SidebarItem
          icon={Calendar}
          label="日历"
          active={currentView === 'calendar'}
          onClick={() => onViewChange('calendar')}
        />
      </nav>

      {/* 标签区域 */}
      <div className="mt-6 px-3 flex-1">
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

      {/* 设置按钮 - 底部 */}
      <div className="p-3 border-t border-black/[0.03] dark:border-white/[0.06]">
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
      </div>
    </aside>
  )
}
