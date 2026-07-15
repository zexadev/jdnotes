import { memo, useState, type ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, ChevronRight, Loader2, AlertCircle, FileText, Search, Tags,
  FilePlus2, PenLine, Trash2, Image as ImageIcon, Globe, Link2, Wrench,
} from 'lucide-react'

const TOOL_META: Record<string, { label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  list_notes: { label: '列出笔记', icon: FileText },
  read_current_note: { label: '读取当前笔记', icon: FileText },
  read_note: { label: '读取笔记', icon: FileText },
  append_note: { label: '追加到笔记', icon: PenLine },
  get_location: { label: '获取位置', icon: Globe },
  search_notes: { label: '搜索笔记', icon: Search },
  list_tags: { label: '列出标签', icon: Tags },
  get_notes_by_tag: { label: '按标签查找', icon: Tags },
  create_note: { label: '创建笔记', icon: FilePlus2 },
  update_note: { label: '修改笔记', icon: PenLine },
  delete_note: { label: '删除笔记', icon: Trash2 },
  get_note_images: { label: '获取图片', icon: ImageIcon },
  web_search: { label: '联网搜索', icon: Globe },
  web_fetch: { label: '读取网页', icon: Link2 },
}

// 工具执行失败的宽松判定（executeToolCall 返回字符串，无结构化错误位）
function looksLikeError(result: string): boolean {
  return /^(错误|执行失败|调用失败|Error|\{"error")/i.test(result.trimStart())
}

function prettyResult(result: string): string {
  try {
    return JSON.stringify(JSON.parse(result), null, 2)
  } catch {
    return result
  }
}

interface ToolCallCardProps {
  name: string
  params: Record<string, unknown>
  result?: string
}

// 工具调用卡片：运行中 spinner + 微呼吸边框，完成打勾，可展开参数与结果
export const ToolCallCard = memo(function ToolCallCard({ name, params, result }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const meta = TOOL_META[name] || { label: name, icon: Wrench }
  const Icon = meta.icon
  const running = result === undefined
  const failed = result !== undefined && looksLikeError(result)

  const paramSummary = Object.entries(params)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
    .join('，')

  return (
    <div
      className={`my-1.5 rounded-lg border text-[11px] overflow-hidden transition-colors ${
        running
          ? 'ai-tool-running border-[#5E6AD2]/20 bg-[#5E6AD2]/[0.03]'
          : 'border-black/[0.05] dark:border-white/[0.07] bg-black/[0.015] dark:bg-white/[0.02]'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        <ChevronRight
          className={`h-3 w-3 flex-shrink-0 text-slate-400 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          strokeWidth={1.5}
        />
        <Icon className="h-3 w-3 flex-shrink-0 text-slate-500 dark:text-slate-400" strokeWidth={1.5} />
        <span className="font-medium text-slate-600 dark:text-slate-300 flex-shrink-0">{meta.label}</span>
        {paramSummary && (
          <span className="text-slate-400 dark:text-slate-500 truncate flex-1 min-w-0">{paramSummary}</span>
        )}
        <span className="flex-shrink-0 ml-auto pl-1.5">
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin text-[#5E6AD2]" />
          ) : failed ? (
            <AlertCircle className="h-3 w-3 text-red-400" />
          ) : (
            <Check className="h-3 w-3 text-emerald-500" />
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-2.5 py-2 border-t border-black/[0.04] dark:border-white/[0.05] space-y-1.5">
              {Object.keys(params).length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 select-none">参数</div>
                  <pre className="text-[10px] text-slate-500 dark:text-slate-400 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-24 overflow-y-auto">
                    {JSON.stringify(params, null, 2)}
                  </pre>
                </div>
              )}
              {result !== undefined && (
                <div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 select-none">结果</div>
                  <pre className={`text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed max-h-36 overflow-y-auto ${failed ? 'text-red-400/90' : 'text-slate-500 dark:text-slate-400'}`}>
                    {prettyResult(result).slice(0, 1200)}
                    {result.length > 1200 ? '\n…' : ''}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})
