import { useRef } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  CodeSquare,
  ImagePlus,
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
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      editor.chain().focus().setImage({ src: base64 }).run()
    }
    reader.readAsDataURL(file)

    // 重置 input 以便重复选同一文件
    e.target.value = ''
  }

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
    ],
  ]

  return (
    <div className="flex items-center gap-0.5 py-1.5">
      {buttons.map((group, groupIndex) => (
        <div key={groupIndex} className="flex items-center gap-0.5">
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
