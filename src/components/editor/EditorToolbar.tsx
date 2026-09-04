import { useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  CodeSquare,
  ImagePlus,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'

interface EditorToolbarProps {
  editor: Editor
}

interface ToolbarButton {
  icon: React.ReactNode
  title: string
  action: () => void
  isActive: () => boolean
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageInsert = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    )
    if (files.length === 0) return

    // 读完所有图片再一次性按顺序插入，避免逐张 setImage 互相覆盖；
    // 用 allSettled：个别图片读取失败时仍插入其余的，而不是整批静默丢弃
    Promise.allSettled(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
      )
    ).then((settled) => {
      const srcs = settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map((r) => r.value)
      const failed = settled.length - srcs.length
      if (failed > 0) console.error(`插入图片：${failed} 张读取失败已跳过`)
      if (srcs.length === 0) return
      editor
        .chain()
        .focus()
        .insertContent(srcs.map((src) => ({ type: 'image', attrs: { src } })))
        .run()
    })

    // 重置 input 以便重复选同一文件
    e.target.value = ''
  }

  const [showHighlightColors, setShowHighlightColors] = useState(false)

  const highlightColors = [
    { name: '黄色', color: '#fcd34d' },
    { name: '绿色', color: '#6ee7b7' },
    { name: '蓝色', color: '#93c5fd' },
    { name: '粉色', color: '#f9a8d4' },
    { name: '紫色', color: '#c4b5fd' },
  ]

  const buttons: ToolbarButton[][] = [
    // 文本格式
    [
      {
        icon: <Bold className="h-4 w-4" />,
        title: '加粗',
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive('bold'),
      },
      {
        icon: <Italic className="h-4 w-4" />,
        title: '斜体',
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive('italic'),
      },
      {
        icon: <Underline className="h-4 w-4" />,
        title: '下划线',
        action: () => editor.chain().focus().toggleUnderline().run(),
        isActive: () => editor.isActive('underline'),
      },
      {
        icon: <Strikethrough className="h-4 w-4" />,
        title: '删除线',
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive('strike'),
      },
      {
        icon: <Code className="h-4 w-4" />,
        title: '内联代码',
        action: () => editor.chain().focus().toggleCode().run(),
        isActive: () => editor.isActive('code'),
      },
      {
        icon: <Highlighter className="h-4 w-4" />,
        title: '高亮',
        action: () => setShowHighlightColors(!showHighlightColors),
        isActive: () => editor.isActive('highlight'),
      },
    ],
    // 列表操作
    [
      {
        icon: <List className="h-4 w-4" />,
        title: '无序列表',
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList'),
      },
      {
        icon: <ListOrdered className="h-4 w-4" />,
        title: '有序列表',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive('orderedList'),
      },
      {
        icon: <ListChecks className="h-4 w-4" />,
        title: '待办列表',
        action: () => editor.chain().focus().toggleTaskList().run(),
        isActive: () => editor.isActive('taskList'),
      },
    ],
    // 对齐
    [
      {
        icon: <AlignLeft className="h-4 w-4" />,
        title: '左对齐',
        action: () => editor.chain().focus().setTextAlign('left').run(),
        isActive: () => editor.isActive({ textAlign: 'left' }),
      },
      {
        icon: <AlignCenter className="h-4 w-4" />,
        title: '居中',
        action: () => editor.chain().focus().setTextAlign('center').run(),
        isActive: () => editor.isActive({ textAlign: 'center' }),
      },
      {
        icon: <AlignRight className="h-4 w-4" />,
        title: '右对齐',
        action: () => editor.chain().focus().setTextAlign('right').run(),
        isActive: () => editor.isActive({ textAlign: 'right' }),
      },
    ],
    // 其他
    [
      {
        icon: <Quote className="h-4 w-4" />,
        title: '引用',
        action: () => editor.chain().focus().toggleBlockquote().run(),
        isActive: () => editor.isActive('blockquote'),
      },
      {
        icon: <Minus className="h-4 w-4" />,
        title: '分割线',
        action: () => editor.chain().focus().setHorizontalRule().run(),
        isActive: () => false,
      },
      {
        icon: <CodeSquare className="h-4 w-4" />,
        title: '代码块',
        action: () => editor.chain().focus().toggleCodeBlock().run(),
        isActive: () => editor.isActive('codeBlock'),
      },
      {
        icon: <ImagePlus className="h-4 w-4" />,
        title: '插入图片',
        action: handleImageInsert,
        isActive: () => false,
      },
      {
        icon: <Table className="h-4 w-4" />,
        title: '插入表格',
        action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        isActive: () => editor.isActive('table'),
      },
    ],
  ]

  return (
    <div className="no-scrollbar flex items-center gap-0.5 py-1.5 relative overflow-x-auto md:overflow-visible">
      {buttons.map((group, groupIndex) => (
        <div key={groupIndex} className="flex items-center gap-0.5 flex-shrink-0">
          {groupIndex > 0 && (
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
          )}
          {group.map((button, buttonIndex) => (
            <button
              key={buttonIndex}
              onClick={button.action}
              title={button.title}
              className={`p-1.5 rounded-md transition-colors ${
                button.isActive()
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {button.icon}
            </button>
          ))}
        </div>
      ))}

      {/* 高亮颜色选择器 */}
      {showHighlightColors && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-[#16181D] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 flex items-center gap-1.5">
          {highlightColors.map((c) => (
            <button
              key={c.color}
              title={c.name}
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: c.color }).run()
                setShowHighlightColors(false)
              }}
              className="w-6 h-6 rounded-full border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              style={{ backgroundColor: c.color }}
            />
          ))}
          <button
            title="清除高亮"
            onClick={() => {
              editor.chain().focus().unsetHighlight().run()
              setShowHighlightColors(false)
            }}
            className="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
          >
            ×
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
