import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface TagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
}

export function TagsInput({ tags, onChange, disabled = false }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      const newTag = inputValue.trim()
      // 避免重复标签
      if (!tags.includes(newTag)) {
        onChange([...tags, newTag])
      }
      setInputValue('')
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // 删除最后一个标签
      onChange(tags.slice(0, -1))
    }
  }

  const removeTag = (tagToRemove: string) => {
    if (disabled) return
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AnimatePresence mode="popLayout">
        {tags.map((tag) => (
          <motion.span
            key={tag}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-dark-card text-gray-600 dark:text-gray-300 text-xs rounded-md border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            {tag}
            {!disabled && (
              <button
                onClick={() => removeTag(tag)}
                className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </motion.span>
        ))}
      </AnimatePresence>
      {!disabled && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? '添加标签...' : ''}
          className="flex-1 min-w-[80px] text-xs text-gray-600 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 bg-transparent border-none outline-none"
        />
      )}
    </div>
  )
}
