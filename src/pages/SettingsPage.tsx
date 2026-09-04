import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Settings as SettingsIcon, Database, Bell, RefreshCw, Info, BookOpen, MonitorSmartphone, ChevronLeft, ChevronRight } from 'lucide-react'
import { AISettings } from './settings/AISettings'
import { DataSettings } from './settings/DataSettings'
import { NotificationSettings } from './settings/NotificationSettings'
import { UpdateSettings } from './settings/UpdateSettings'
import { AboutSettings } from './settings/AboutSettings'
import { MarkdownGuide } from './settings/MarkdownGuide'
import { SyncSettings } from './settings/SyncSettings'

interface SettingsPageProps {
  onClose: () => void
  onDataChange?: () => void
}

type SettingsSection = 'ai' | 'data' | 'sync' | 'notifications' | 'update' | 'markdown' | 'about'

const SECTIONS = [
  { id: 'ai' as const, label: 'AI 配置', icon: SettingsIcon },
  { id: 'data' as const, label: '数据管理', icon: Database },
  { id: 'sync' as const, label: '设备同步', icon: MonitorSmartphone },
  { id: 'notifications' as const, label: '通知', icon: Bell },
  { id: 'update' as const, label: '更新', icon: RefreshCw },
  { id: 'markdown' as const, label: 'Markdown 指南', icon: BookOpen },
  { id: 'about' as const, label: '关于', icon: Info },
]

export function SettingsPage({ onClose, onDataChange }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai')

  // 窄屏下导航是横向滚动条，滚动条又被藏了——两端渐隐 + 箭头提示还有更多，滚到头自动消失
  const navRef = useRef<HTMLElement>(null)
  const [overflow, setOverflow] = useState({ left: false, right: false })
  const measureOverflow = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    setOverflow({
      left: nav.scrollLeft > 1,
      right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1,
    })
  }, [])
  useEffect(() => {
    measureOverflow()
    const nav = navRef.current
    if (!nav) return
    const observer = new ResizeObserver(measureOverflow)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [measureOverflow])

  // 切换分区时把当前 tab 滚进可视区（从概览进设置时选中的可能在屏幕外）
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`)
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeSection])

  const scrollNav = (direction: 1 | -1) => {
    navRef.current?.scrollBy({ left: direction * 160, behavior: 'smooth' })
  }

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-dark-bg">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          设置
        </h1>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 导航：桌面左侧竖排，窄屏顶部横向滚动 */}
        <div className="relative w-full md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-sidebar">
          <nav
            ref={navRef}
            onScroll={measureOverflow}
            className="no-scrollbar p-2 md:p-3 flex md:flex-col gap-1 md:gap-0 md:space-y-1 overflow-x-auto"
          >
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id

              return (
                <button
                  key={section.id}
                  data-section={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    md:w-full flex-shrink-0 whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-[#5E6AD2] text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              )
            })}
          </nav>

          {overflow.left && (
            <button
              onClick={() => scrollNav(-1)}
              className="md:hidden absolute inset-y-0 left-0 w-12 flex items-center justify-start pl-1 bg-gradient-to-r from-gray-50 via-gray-50/90 to-transparent dark:from-dark-sidebar dark:via-dark-sidebar/90"
              title="更多"
            >
              <ChevronLeft className="h-4 w-4 text-gray-400" strokeWidth={2} />
            </button>
          )}
          {overflow.right && (
            <button
              onClick={() => scrollNav(1)}
              className="md:hidden absolute inset-y-0 right-0 w-12 flex items-center justify-end pr-1 bg-gradient-to-l from-gray-50 via-gray-50/90 to-transparent dark:from-dark-sidebar dark:via-dark-sidebar/90"
              title="更多"
            >
              <ChevronRight className="h-4 w-4 text-gray-400" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 overflow-y-auto">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 md:p-8"
          >
            {activeSection === 'ai' && <AISettings />}
            {activeSection === 'data' && <DataSettings onDataChange={onDataChange} />}
            {activeSection === 'sync' && <SyncSettings onDataChange={onDataChange} />}
            {activeSection === 'notifications' && <NotificationSettings />}
            {activeSection === 'update' && <UpdateSettings />}
            {activeSection === 'markdown' && <MarkdownGuide />}
            {activeSection === 'about' && <AboutSettings />}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
