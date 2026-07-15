import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Square, Image as ImageIcon, X } from 'lucide-react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  attachedImages: string[]
  onAttachImages: (base64List: string[]) => void
  onRemoveImage: (index: number) => void
}

function filesToBase64(files: FileList | File[]): Promise<string[]> {
  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
  return Promise.all(
    imageFiles.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
    )
  )
}

// 输入区：自动增高、Enter 发送、粘贴图片直接附加、发送↔停止按钮随流式态切换
export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  attachedImages,
  onAttachImages,
  onRemoveImage,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isMultiLine, setIsMultiLine] = useState(false)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 150)
    textarea.style.height = `${newHeight}px`
    setIsMultiLine(newHeight > 36)
  }, [])

  // 重挂载（关闭再打开侧栏）时 value 可能已有多行内容，恢复高度
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value) adjustHeight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部清空输入（发送后）时复位高度；rAF 内 setState 避免 effect 级联渲染
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const raf = requestAnimationFrame(() => setIsMultiLine(false))
      return () => cancelAnimationFrame(raf)
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!isStreaming) onSend()
    }
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault()
      onStop()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files
    if (!files || files.length === 0) return
    const hasImage = Array.from(files).some((f) => f.type.startsWith('image/'))
    if (!hasImage) return
    // preventDefault 必须同步调用（await 之后事件已经默认处理完了）
    e.preventDefault()
    void filesToBase64(files).then((images) => {
      if (images.length > 0) onAttachImages(images)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const images = await filesToBase64(e.target.files)
      if (images.length > 0) onAttachImages(images)
    }
    e.target.value = ''
  }

  const canSend = value.trim().length > 0 || attachedImages.length > 0

  // 停止按钮刚出现的短暂窗口内禁用：发送→停止原位切换，双击/连击会误停刚发的请求
  const [stopArmed, setStopArmed] = useState(false)
  useEffect(() => {
    if (!isStreaming) return
    setStopArmed(false)
    const t = setTimeout(() => setStopArmed(true), 350)
    return () => clearTimeout(t)
  }, [isStreaming])

  return (
    <div>
      {/* 附加图片 chips */}
      <AnimatePresence initial={false}>
        {attachedImages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5 flex-wrap pb-2">
              {attachedImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img}
                    alt=""
                    className="h-12 w-12 object-cover rounded-lg border border-black/[0.06] dark:border-white/[0.08]"
                  />
                  <button
                    onClick={() => onRemoveImage(idx)}
                    className="absolute -top-1.5 -right-1.5 p-0.5 bg-slate-600 dark:bg-slate-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`input-pill flex items-end gap-2 px-3.5 py-2.5 border border-black/[0.04] dark:border-white/[0.08] focus-within:border-[#5E6AD2]/40 focus-within:ring-1 focus-within:ring-[#5E6AD2]/20 transition-all duration-150 ${
          !isMultiLine ? 'single-line' : ''
        }`}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1 text-slate-400 hover:text-[#5E6AD2] transition-colors flex-shrink-0"
          title="附加图片（也可直接粘贴）"
        >
          <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息…"
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-[13px] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
          style={{ maxHeight: '150px' }}
        />
        {/* 发送 ↔ 停止 */}
        {isStreaming ? (
          <motion.button
            key="stop"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => { if (stopArmed) onStop() }}
            className="p-1.5 rounded-lg flex-shrink-0 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="停止生成 (Esc)"
          >
            <Square className="h-4 w-4 fill-current" strokeWidth={0} />
          </motion.button>
        ) : (
          <motion.button
            key="send"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={onSend}
            disabled={!canSend}
            className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
              canSend
                ? 'text-[#5E6AD2] hover:bg-[#5E6AD2]/10'
                : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
            }`}
            title="发送 (Enter)"
          >
            <Send className="h-4 w-4" strokeWidth={1.5} />
          </motion.button>
        )}
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center select-none">
        {isStreaming ? 'Esc 停止生成' : 'Enter 发送 · Shift + Enter 换行'}
      </p>
    </div>
  )
}
