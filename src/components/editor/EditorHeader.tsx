import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { formatDateTime, formatTime, isSameDay } from '../../lib/utils'

interface EditorHeaderProps {
  title: string
  isEditing: boolean
  createdAt: Date | number
  updatedAt: Date | number
  onTitleChange: (title: string) => void
  onGenerateMeta: () => void
  isGeneratingMeta: boolean
}

export function EditorHeader({
  title,
  isEditing,
  createdAt,
  updatedAt,
  onTitleChange,
  onGenerateMeta,
  isGeneratingMeta,
}: EditorHeaderProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整标题输入框高度
  useEffect(() => {
    const textarea = titleRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [title])

  return (
    <>
      {/* 标题区域 */}
      <div className="relative flex items-start gap-2">
        <div className="flex-1">
          {isEditing ? (
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="无标题"
              rows={1}
              className="w-full text-4xl font-bold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 border-none outline-none bg-transparent tracking-tight resize-none overflow-hidden"
            />
          ) : (
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {title || '无标题'}
            </h1>
          )}
        </div>
        {/* AI 生成标题和标签按钮 */}
        {isEditing && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onGenerateMeta}
            disabled={isGeneratingMeta}
            className="mt-2 p-1.5 text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-lg transition-colors disabled:opacity-50"
            title="AI 生成标题和标签"
          >
            {isGeneratingMeta ? (
              <span className="inline-block w-4 h-4 border-2 border-[#5E6AD2] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
            )}
          </motion.button>
        )}
      </div>

      {/* 日期元数据 */}
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mt-2 mb-4">
        <span>创建于 {formatDateTime(createdAt)}</span>
        <span>•</span>
        <span>
          最后修改于{' '}
          {isSameDay(createdAt, updatedAt)
            ? formatTime(updatedAt)
            : formatDateTime(updatedAt)}
        </span>
      </div>
    </>
  )
}
