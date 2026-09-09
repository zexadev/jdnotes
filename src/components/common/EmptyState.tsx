import { FileText, SearchX } from 'lucide-react'
import { isMobilePlatform } from '../../lib/platform'

export function EmptyState({ onCreateNote }: { onCreateNote: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
      <FileText className="h-16 w-16 mb-4" strokeWidth={1} />
      <p className="text-[14px]">选择一个笔记开始编辑</p>
      <p className="text-[12px] mt-1">或者创建一个新笔记</p>
      <button
        onClick={onCreateNote}
        className="mt-4 px-4 py-2 bg-[#5E6AD2] text-white text-[13px] rounded-lg hover:bg-[#4F5ABF] transition-colors btn-press"
      >
        创建笔记
      </button>
    </div>
  )
}

export function NoSearchResultState({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-slate-400 dark:text-slate-500">
      <SearchX className="h-12 w-12 mb-3" strokeWidth={1} />
      <p className="text-[13px]">
        未找到匹配「<span className="text-slate-600 dark:text-slate-300">{query}</span>」的笔记
      </p>
      <button
        onClick={onClear}
        className="mt-3 px-3 py-1.5 bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 text-[12px] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm btn-press"
      >
        清空搜索
      </button>
    </div>
  )
}

export function NoNotesState({ onCreateNote }: { onCreateNote: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
      <FileText className="h-12 w-12 mb-3" strokeWidth={1} />
      <p className="text-[13px]">暂无笔记</p>
      {/* 手机不种欢迎笔记（见 App.tsx 初始化），空库时把「从电脑同步过来」这条路指出来 */}
      {isMobilePlatform && (
        <p className="mt-1 text-[12px] text-slate-400/80 dark:text-slate-500/80 text-center px-8">
          电脑上已有笔记？在「设置 › 设备同步」配对后同步过来
        </p>
      )}
      <button
        onClick={onCreateNote}
        className="mt-3 px-3 py-1.5 bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 text-[12px] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors shadow-sm btn-press"
      >
        创建第一个笔记
      </button>
    </div>
  )
}
