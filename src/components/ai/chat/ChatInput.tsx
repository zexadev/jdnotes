import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Square, Image as ImageIcon, X } from 'lucide-react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { readFile } from '@tauri-apps/plugin-fs'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  isStreaming: boolean
  attachedImages: string[]
  onAttachImages: (base64List: string[]) => void
  onRemoveImage: (index: number) => void
  // 底行左侧插槽（模型选择器 + 上下文占用），由侧栏组装
  footerLeft?: React.ReactNode
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

const IMAGE_EXT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
}

// 一体化输入卡：图片 chips + 自动增高输入框 + 底行（模型选择器插槽 | 附图/发送）。
// Enter 发送、Shift+Enter 换行、粘贴/拖拽附图、发送↔停止随流式态切换
export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  attachedImages,
  onAttachImages,
  onRemoveImage,
  footerLeft,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [dragHover, setDragHover] = useState(false)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }, [])

  // 挂载即聚焦（侧栏默认关闭，出现一定是用户主动打开）；重挂载时恢复已有内容的高度
  useEffect(() => {
    textareaRef.current?.focus()
    if (textareaRef.current?.value) adjustHeight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部清空输入（发送后）时复位高度
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
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

  // Tauri 原生拖拽：落点在侧栏内的图片文件附加到输入区（编辑器只认自己区域内的落点，互不抢）
  const onAttachImagesRef = useRef(onAttachImages)
  onAttachImagesRef.current = onAttachImages
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false

    const inSidebar = (pos: { x: number; y: number }) => {
      const el = document.querySelector('.ai-chat-sidebar')
      if (!el) return false
      const rect = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const x = pos.x / dpr
      const y = pos.y / dpr
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    }

    getCurrentWebview().onDragDropEvent(async (event) => {
      const t = event.payload.type
      if (t === 'over') {
        setDragHover(inSidebar(event.payload.position))
        return
      }
      if (t === 'leave') {
        setDragHover(false)
        return
      }
      if (t !== 'drop') return
      setDragHover(false)
      if (!inSidebar(event.payload.position)) return

      const srcs: string[] = []
      for (const filePath of event.payload.paths) {
        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
        const mime = IMAGE_EXT_MIME[ext]
        if (!mime) continue
        try {
          const data = await readFile(filePath)
          const base64 = btoa(Array.from(data).map((b) => String.fromCharCode(b)).join(''))
          srcs.push(`data:${mime};base64,${base64}`)
        } catch (err) {
          console.error('拖拽附加图片失败:', err)
        }
      }
      if (srcs.length > 0) onAttachImagesRef.current(srcs)
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  // 图片放大预览：Esc 关闭
  useEffect(() => {
    if (!previewImage) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setPreviewImage(null)
      }
    }
    document.addEventListener('keydown', onEsc, true)
    return () => document.removeEventListener('keydown', onEsc, true)
  }, [previewImage])

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
      <div
        className={`input-pill px-3 pt-2.5 pb-2 border transition-all duration-150 ${
          dragHover
            ? 'border-[#5E6AD2]/60 ring-2 ring-[#5E6AD2]/20'
            : 'border-black/[0.04] dark:border-white/[0.08] focus-within:border-[#5E6AD2]/40 focus-within:ring-1 focus-within:ring-[#5E6AD2]/20'
        }`}
      >
        {/* 拖拽悬停提示 */}
        <AnimatePresence initial={false}>
          {dragHover && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="overflow-hidden"
            >
              <p className="pb-1.5 text-[11px] text-[#5E6AD2]">松开鼠标，图片将附加到对话</p>
            </motion.div>
          )}
        </AnimatePresence>

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
                      onClick={() => setPreviewImage(img)}
                      className="h-12 w-12 object-cover rounded-lg border border-black/[0.06] dark:border-white/[0.08] cursor-zoom-in"
                    />
                    <button
                      onClick={() => onRemoveImage(idx)}
                      className="absolute -top-1.5 -right-1.5 p-1 md:p-0.5 bg-slate-600 dark:bg-slate-500 text-white rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      title="移除"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isStreaming ? '正在生成，Esc 停止…' : '输入消息，Enter 发送…'}
          rows={1}
          className="w-full bg-transparent border-none outline-none resize-none text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
          style={{ maxHeight: '150px' }}
        />

        {/* 底行：模型选择器插槽 | 附图 + 发送/停止 */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">{footerLeft}</div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 transition-colors"
              title="附加图片（可粘贴或拖入）"
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
            {isStreaming ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => { if (stopArmed) onStop() }}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
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
                className={`p-1.5 rounded-lg transition-all ${
                  canSend
                    ? 'bg-[#5E6AD2] text-white hover:bg-[#4F5ABF] shadow-sm'
                    : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
                title="发送 (Enter · Shift+Enter 换行)"
              >
                <Send className="h-4 w-4" strokeWidth={1.5} />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* 图片放大预览 */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 cursor-zoom-out"
          >
            <img src={previewImage} alt="" className="max-w-[85vw] max-h-[85vh] rounded-lg shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
