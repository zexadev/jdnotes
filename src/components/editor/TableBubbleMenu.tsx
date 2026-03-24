import { BubbleMenu } from '@tiptap/react/menus'
import { type Editor } from '@tiptap/react'
import {
  Trash,
  Trash2,
  Combine,
  Split,
  Heading
} from 'lucide-react'

const InsertRowAboveIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4H3z" fill="currentColor" fillOpacity="0.4" stroke="none" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
)

const InsertRowBelowIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 15h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" fillOpacity="0.4" stroke="none" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
)

const InsertColLeftIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 3h4v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" fillOpacity="0.4" stroke="none" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
)

const InsertColRightIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H15z" fill="currentColor" fillOpacity="0.4" stroke="none" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
)

interface TableBubbleMenuProps {
  editor: Editor
}

export function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 10,
      }}
      pluginKey="tableBubbleMenu"
      shouldShow={() => {
        return editor.isActive('table')
      }}
      className="flex flex-col gap-0 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-in fade-in zoom-in duration-200"
    >
      <div className="flex items-center px-1 py-1">
        {/* 行操作 */}
        <div className="flex items-center px-1 border-r border-gray-100 dark:border-gray-800">
          <FormatButton
            onClick={() => editor.chain().focus().addRowBefore().run()}
            icon={<InsertRowAboveIcon className="h-4 w-4" />}
            label="上方插入行"
          />
          <FormatButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            icon={<InsertRowBelowIcon className="h-4 w-4" />}
            label="下方插入行"
          />
          <FormatButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            icon={<Trash className="h-4 w-4" />}
            label="删除当前行"
            danger
          />
        </div>

        {/* 列操作 */}
        <div className="flex items-center px-1 border-r border-gray-100 dark:border-gray-800">
          <FormatButton
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            icon={<InsertColLeftIcon className="h-4 w-4" />}
            label="左侧插入列"
          />
          <FormatButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            icon={<InsertColRightIcon className="h-4 w-4" />}
            label="右侧插入列"
          />
          <FormatButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            icon={<Trash className="h-4 w-4" />}
            label="删除当前列"
            danger
          />
        </div>

        {/* 单元格与表头 */}
        <div className="flex items-center px-1 border-r border-gray-100 dark:border-gray-800">
          <FormatButton
            onClick={() => editor.chain().focus().mergeCells().run()}
            icon={<Combine className="h-4 w-4" />}
            label="合并单元格"
          />
          <FormatButton
            onClick={() => editor.chain().focus().splitCell().run()}
            icon={<Split className="h-4 w-4" />}
            label="拆分单元格"
          />
          <FormatButton
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            icon={<Heading className="h-4 w-4" />}
            label="切换表头行"
          />
        </div>

        {/* 表格操作 */}
        <div className="flex items-center px-1">
          <FormatButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            icon={<Trash2 className="h-4 w-4" />}
            label="删除表格"
            danger
          />
        </div>
      </div>
    </BubbleMenu>
  )
}

function FormatButton({ onClick, icon, label, danger }: { onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-all ${
        danger 
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-[rgba(127,29,29,0.3)]' 
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
      title={label}
    >
      {icon}
    </button>
  )
}
