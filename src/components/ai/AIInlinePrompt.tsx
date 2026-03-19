import { useState, useEffect, useRef } from 'react'
import { Send, Sparkles } from 'lucide-react'

interface AIInlinePromptProps {
  position: { top: number; left: number }
  hasSelection: boolean
  onSubmit: (prompt: string) => void
  onClose: () => void
}

export function AIInlinePrompt({ position, hasSelection, onSubmit, onClose }: AIInlinePromptProps) {
  const [prompt, setPrompt] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
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

  return (
    <div
      ref={containerRef}
      className="absolute z-50 animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 min-w-[320px]">
        <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={hasSelection ? '对选中内容做什么...' : '让 AI 帮你写点什么...'}
          className="flex-1 text-sm text-gray-900 dark:text-gray-100 bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
            Enter
          </kbd>
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="p-1.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
