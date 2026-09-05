import { memo, useState, useRef, useEffect } from 'react'
import { Copy, Check, Pencil, Trash2 } from 'lucide-react'

interface UserMessageProps {
  /** 落库消息带 id；发送中的临时消息无 id（不显示操作按钮） */
  message: { id?: number; content: string; images?: string[] }
  isTemporary?: boolean
  isAnyStreaming: boolean
  onCopy: (content: string) => void
  onEdit: (id: number, newContent: string) => void
  onDelete: (id: number) => void
}

// 用户消息：右对齐主色气泡 + 图片附件 + 悬停操作（编辑重发/复制/删除）
export const UserMessage = memo(function UserMessage({
  message,
  isTemporary = false,
  isAnyStreaming,
  onCopy,
  onEdit,
  onDelete,
}: UserMessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
      textarea.focus()
      textarea.select()
    }
  }, [isEditing])

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content && message.id !== undefined) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="w-full flex flex-col gap-2 py-2">
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => {
            setEditContent(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              handleSaveEdit()
            } else if (e.key === 'Escape') {
              handleCancelEdit()
            }
          }}
          className="w-full bg-white/80 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 border border-black/[0.06] dark:border-white/[0.06] rounded-lg px-3 py-2 text-[13px] resize-none outline-none focus:border-[#5E6AD2]/50 focus:ring-1 focus:ring-[#5E6AD2]/30 transition-all"
          rows={1}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Enter 发送 · Esc 取消</span>
          <div className="flex gap-1">
            <button
              onClick={handleCancelEdit}
              className="px-2 py-1 text-[11px] rounded-md text-slate-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            >
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-2 py-1 text-[11px] rounded-md bg-[#5E6AD2] text-white hover:bg-[#4F5ABF]"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col items-end py-2">
      {message.images && message.images.length > 0 && (
        <div className="flex gap-1.5 mb-1.5 flex-wrap justify-end">
          {message.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt=""
              className="h-16 w-16 object-cover rounded-lg border border-black/[0.06] dark:border-white/[0.06]"
            />
          ))}
        </div>
      )}
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#5E6AD2] text-white text-[13px] leading-relaxed">
        <span className="whitespace-pre-wrap break-words">{message.content}</span>
      </div>
      {!isTemporary && message.id !== undefined && (
        <div className="flex items-center gap-0.5 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => { onCopy(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
            className="p-2 md:p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
            title="复制"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" strokeWidth={1.5} />}
          </button>
          <button
            onClick={() => setIsEditing(true)}
            disabled={isAnyStreaming}
            className="p-2 md:p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="编辑并重发"
          >
            <Pencil className="h-3 w-3" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => { if (message.id !== undefined) onDelete(message.id) }}
            className="p-2 md:p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
            title="删除"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
})
