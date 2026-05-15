import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Users, Kanban, BookOpen, BarChart } from 'lucide-react'

export interface NoteTemplate {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  noteTitle: string
  content: string
}

const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    title: '空白笔记',
    description: '从空白开始写作',
    icon: <FileText className="h-5 w-5" />,
    noteTitle: '无标题',
    content: '',
  },
  {
    id: 'meeting',
    title: '会议记录',
    description: '结构化的会议纪要模板',
    icon: <Users className="h-5 w-5" />,
    noteTitle: '会议记录',
    content: `## 会议信息

- **日期**：
- **参与者**：
- **主题**：

## 议程

1.

## 讨论要点



## 决议事项

- [ ]

## 下一步行动

- [ ] `,
  },
  {
    id: 'project',
    title: '项目计划',
    description: '项目规划与里程碑追踪',
    icon: <Kanban className="h-5 w-5" />,
    noteTitle: '项目计划',
    content: `## 项目概述

**项目名称**：

**负责人**：

**截止日期**：

## 目标



## 里程碑

- [ ] 阶段一：
- [ ] 阶段二：
- [ ] 阶段三：

## 资源需求



## 风险评估



## 备注

`,
  },
  {
    id: 'reading',
    title: '读书笔记',
    description: '记录阅读收获与思考',
    icon: <BookOpen className="h-5 w-5" />,
    noteTitle: '读书笔记',
    content: `## 书籍信息

- **书名**：
- **作者**：
- **评分**：

## 核心观点



## 精彩摘录

>

## 个人思考



## 行动计划

- [ ] `,
  },
  {
    id: 'weekly',
    title: '周报',
    description: '每周工作总结与计划',
    icon: <BarChart className="h-5 w-5" />,
    noteTitle: '周报',
    content: `## 本周完成

-

## 进行中

-

## 下周计划

-

## 遇到的问题



## 需要的支持

`,
  },
]

interface TemplateModalProps {
  open: boolean
  onClose: () => void
  onSelect: (template: NoteTemplate) => void
}

export function TemplateModal({ open, onClose, onSelect }: TemplateModalProps) {
  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  const handleSelect = (template: NoteTemplate) => {
    onSelect(template)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* 模态框 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-xl mx-4 bg-white dark:bg-[#16181D] rounded-2xl shadow-2xl"
          >
            {/* 头部 */}
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                选择模板
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                为新笔记选择一个模板
              </p>
            </div>

            {/* 模板网格 */}
            <div className="px-6 pb-6 pt-4 grid grid-cols-2 gap-3">
              {BUILT_IN_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.15] transition-all duration-150 text-left group"
                >
                  <div className="p-2 rounded-lg bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 group-hover:text-[#5E6AD2] group-hover:border-[#5E6AD2]/30 dark:group-hover:border-[#5E6AD2]/30 transition-colors duration-150 flex-shrink-0">
                    {template.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {template.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {template.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
