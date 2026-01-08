import { ChevronLeft, ChevronRight, Calendar, Download, Flame } from 'lucide-react'
import { motion } from 'framer-motion'
import type { CalendarView, DateField } from '../../hooks/useCalendar'
import { getWeekNumber } from '../../hooks/useCalendar'

interface CalendarHeaderProps {
  currentDate: Date
  view: CalendarView
  dateField: DateField
  showHeatmap: boolean
  onViewChange: (view: CalendarView) => void
  onDateFieldChange: (field: DateField) => void
  onHeatmapToggle: (show: boolean) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onExport: () => void
}

export function CalendarHeader({
  currentDate,
  view,
  dateField,
  showHeatmap,
  onViewChange,
  onDateFieldChange,
  onHeatmapToggle,
  onPrevious,
  onNext,
  onToday,
  onExport,
}: CalendarHeaderProps) {
  const formatTitle = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1

    switch (view) {
      case 'month':
        return `${year}年${month}月`
      case 'week':
        return `${year}年第${getWeekNumber(currentDate)}周`
      case 'day':
        return `${year}年${month}月${currentDate.getDate()}日`
    }
  }

  return (
    <div className="px-6 py-4 border-b border-black/[0.03] dark:border-white/[0.06]">
      <div className="flex items-center justify-between">
        {/* 左侧：标题和导航 */}
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-slate-400" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {formatTitle()}
          </h2>

          <div className="flex items-center gap-1 ml-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onPrevious}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onNext}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToday}
              className="ml-2 px-3 py-1.5 text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              今天
            </motion.button>
          </div>
        </div>

        {/* 右侧：功能按钮 */}
        <div className="flex items-center gap-2">
          {/* 热力图切换（仅月视图） */}
          {view === 'month' && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onHeatmapToggle(!showHeatmap)}
              className={`p-2 rounded-lg transition-colors ${
                showHeatmap
                  ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                  : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
              }`}
              title="热力图视图"
            >
              <Flame className="h-4 w-4" strokeWidth={1.5} />
            </motion.button>
          )}

          {/* 导出按钮 */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onExport}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
            title="导出日历"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} />
          </motion.button>

          {/* 时间字段切换 */}
          <div className="flex items-center gap-1 bg-white/50 dark:bg-white/[0.03] rounded-lg p-1 ml-2">
            <button
              onClick={() => onDateFieldChange('createdAt')}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                dateField === 'createdAt'
                  ? 'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              创建时间
            </button>
            <button
              onClick={() => onDateFieldChange('updatedAt')}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                dateField === 'updatedAt'
                  ? 'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              修改时间
            </button>
          </div>

          {/* 视图切换 */}
          <div className="flex items-center gap-1 bg-white/50 dark:bg-white/[0.03] rounded-lg p-1">
            <button
              onClick={() => onViewChange('month')}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                view === 'month'
                  ? 'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              月
            </button>
            <button
              onClick={() => onViewChange('week')}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                view === 'week'
                  ? 'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              周
            </button>
            <button
              onClick={() => onViewChange('day')}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                view === 'day'
                  ? 'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              日
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
