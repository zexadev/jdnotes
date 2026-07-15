import { useState, useEffect, useRef } from 'react'
import { Send, Sparkles, Languages, FileText, PenLine, ArrowRight } from 'lucide-react'
import type { AIAction } from '../../hooks/useAIStream'

interface AIInlinePromptProps {
  position: { top: number; left: number }
  hasSelection: boolean
  onSubmit: (prompt: string) => void
  onQuickAction: (action: AIAction) => void
  onClose: () => void
}

// Ctrl+J 内联 AI 输入条：自由指令 + 快捷动作 chips（选中：改进/翻译/总结；无选中：续写）
export function AIInlinePrompt({ position, hasSelection, onSubmit, onQuickAction, onClose }: AIInlinePromptProps) {
  const [prompt, setPrompt] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const handleSubmit = () => {
    if (!prompt.trim()) return
    onSubmit(prompt)
  }

  const quickActions: { action: AIAction; icon: typeof Sparkles; label: string }[] = hasSelection
    ? [
        { action: 'refine', icon: PenLine, label: '改进写作' },
        { action: 'translate', icon: Languages, label: '翻译' },
        { action: 'summarize', icon: FileText, label: '总结' },
      ]
    : [{ action: 'continue', icon: ArrowRight, label: '续写' }]

  return (
    <div
      ref={containerRef}
      className="absolute z-50 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 min-w-[340px]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#5E6AD2] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={hasSelection ? '对选中内容做什么…' : '让 AI 在这里写点什么…'}
            className="flex-1 text-sm text-gray-900 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="p-1.5 text-white bg-[#5E6AD2] rounded-lg hover:bg-[#4F5ABF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title="发送 (Enter)"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* 快捷动作 */}
        <div className="flex items-center gap-1.5 pl-6">
          {quickActions.map(({ action, icon: Icon, label }) => (
            <button
              key={action}
              onClick={() => onQuickAction(action)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#5E6AD2]/10 hover:text-[#5E6AD2] rounded-md transition-colors"
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 select-none">Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
