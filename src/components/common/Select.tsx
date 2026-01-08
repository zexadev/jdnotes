import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption<T = string> {
  value: T
  label: string
  description?: string
}

interface SelectProps<T = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Select<T = string>({
  value,
  onChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className = '',
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        setIsOpen(false)
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = options.findIndex((opt) => opt.value === value)
        let nextIndex: number

        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1
        }

        onChange(options[nextIndex].value)
      } else if (event.key === 'Enter') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, options, value, onChange])

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-sm text-left
          bg-gray-50 dark:bg-gray-800 
          border border-gray-200 dark:border-gray-700 
          rounded-lg 
          focus:ring-1 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent 
          outline-none transition-all
          flex items-center justify-between gap-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700'}
        `}
      >
        <span className={selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`
                w-full px-3 py-2 text-sm text-left
                flex items-center justify-between gap-2
                transition-colors
                ${
                  option.value === value
                    ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate">{option.label}</div>
                {option.description && (
                  <div className="text-xs text-gray-400 truncate mt-0.5">{option.description}</div>
                )}
              </div>
              {option.value === value && <Check className="h-4 w-4 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
