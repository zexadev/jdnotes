import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Settings as SettingsIcon, Database, Bell, RefreshCw, Info, BookOpen } from 'lucide-react'
import { AISettings } from './settings/AISettings'
import { DataSettings } from './settings/DataSettings'
import { NotificationSettings } from './settings/NotificationSettings'
import { UpdateSettings } from './settings/UpdateSettings'
import { AboutSettings } from './settings/AboutSettings'
import { MarkdownGuide } from './settings/MarkdownGuide'

interface SettingsPageProps {
  onClose: () => void
  onDataChange?: () => void
}

type SettingsSection = 'ai' | 'data' | 'notifications' | 'update' | 'markdown' | 'about'

const SECTIONS = [
  { id: 'ai' as const, label: 'AI 配置', icon: SettingsIcon },
  { id: 'data' as const, label: '数据管理', icon: Database },
  { id: 'notifications' as const, label: '通知', icon: Bell },
  { id: 'update' as const, label: '更新', icon: RefreshCw },
  { id: 'markdown' as const, label: 'Markdown 指南', icon: BookOpen },
  { id: 'about' as const, label: '关于', icon: Info },
]

export function SettingsPage({ onClose, onDataChange }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai')

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
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧导航 */}
        <div className="w-56 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-dark-sidebar">
          <nav className="p-3 space-y-1">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
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
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 overflow-y-auto">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-3xl mx-auto p-8"
          >
            {activeSection === 'ai' && <AISettings />}
            {activeSection === 'data' && <DataSettings onDataChange={onDataChange} />}
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
