import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

interface ImagePreviewProps {
  src: string
  onClose: () => void
}

function ImagePreview({ src, onClose }: ImagePreviewProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const lastPosition = useRef({ x: 0, y: 0 })

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => Math.min(Math.max(0.1, prev + delta), 5))
  }, [])

  // 拖拽移动
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      isDragging.current = true
      lastPosition.current = { x: e.clientX, y: e.clientY }
    }
  }, [scale])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) {
      const deltaX = e.clientX - lastPosition.current.x
      const deltaY = e.clientY - lastPosition.current.y
      lastPosition.current = { x: e.clientX, y: e.clientY }
      setPosition((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 双击重置
  const handleDoubleClick = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <img
        src={src}
        alt="预览"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl select-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          cursor: scale > 1 ? 'grab' : 'zoom-in',
          transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        draggable={false}
      />
      {/* 缩放比例提示 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 text-white text-sm rounded-full">
        {Math.round(scale * 100)}% · 滚轮缩放 · 双击重置
      </div>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  )
}

export function ResizableImage({ node, updateAttributes, selected, editor, deleteNode }: NodeViewProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const { src, alt, title, width } = node.attrs
  const isEditable = editor.isEditable

  // 获取编辑器容器最大可用宽度
  const getMaxWidth = useCallback(() => {
    const container = editor.view.dom.parentElement
    return container ? container.clientWidth : 800
  }, [editor])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = imageRef.current?.offsetWidth || 300

      const handleMouseMove = (e: MouseEvent) => {
        const diff = e.clientX - startXRef.current
        const maxWidth = getMaxWidth()
        const newWidth = Math.min(maxWidth, Math.max(100, startWidthRef.current + diff))
        updateAttributes({ width: newWidth })
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [updateAttributes, isEditable, getMaxWidth]
  )

  const handleImageClick = (e: React.MouseEvent) => {
    if (!isResizing) {
      e.preventDefault()
      setShowPreview(true)
    }
  }

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteNode()
  }, [deleteNode])

  return (
    <NodeViewWrapper className="relative my-4 flex justify-center">
      <div
        className={`relative inline-block group ${selected && isEditable ? 'ring-2 ring-[#5E6AD2] ring-offset-2 dark:ring-offset-gray-900 rounded-lg' : ''}`}
        style={{ width: width ? `${width}px` : 'auto', maxWidth: '100%' }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt || ''}
          title={title || ''}
          onClick={handleImageClick}
          className="block max-w-full h-auto rounded-lg shadow-sm dark:border dark:border-white/[0.06] cursor-zoom-in"
          style={{ width: width ? `${width}px` : 'auto', maxWidth: '100%' }}
          draggable={false}
        />

        {/* 悬浮删除按钮 - 仅编辑模式 */}
        {isEditable && (
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            title="删除图片"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* 缩放提示 - 仅编辑模式显示 */}
        {isEditable && (
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            点击预览 · 拖拽缩放
          </div>
        )}

        {/* 查看模式提示 */}
        {!isEditable && (
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            点击预览
          </div>
        )}

        {/* 右下角缩放手柄 - 仅编辑模式显示 */}
        {isEditable && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ touchAction: 'none' }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-full h-full text-gray-400 dark:text-gray-500"
              fill="currentColor"
            >
              <path d="M14 14H10V12H12V10H14V14Z" />
              <path d="M14 8H12V6H14V8Z" />
              <path d="M8 14H6V12H8V14Z" />
            </svg>
          </div>
        )}

        {/* 右侧缩放手柄 - 仅编辑模式显示 */}
        {isEditable && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-1/2 right-0 -translate-y-1/2 w-2 h-12 bg-gray-400/50 dark:bg-gray-500/50 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500/70"
            style={{ touchAction: 'none' }}
          />
        )}
      </div>

      {/* 图片预览模态框 */}
      {showPreview && (
        <ImagePreview src={src} onClose={() => setShowPreview(false)} />
      )}
    </NodeViewWrapper>
  )
}
