import { BubbleMenu } from '@tiptap/react/menus'
import { type Editor } from '@tiptap/react'
import {
  Sparkles,
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  Link as LinkIcon,
} from 'lucide-react'
import { useCallback } from 'react'

interface AIBubbleMenuProps {
  editor: Editor
  // 打开统一的 AI 输入条（与 Ctrl+J 同一面板：自由指令 + 快捷动作 chips）
  onOpenAIPrompt: () => void
}

// 选中文本的气泡菜单：格式化 + 单个 AI 入口。
// AI 操作统一收敛到 Ctrl+J 输入条，不再在气泡里塞一排 AI 按钮和提问框
export function AIBubbleMenu({ editor, onOpenAIPrompt }: AIBubbleMenuProps) {
  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('输入链接地址', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 10,
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shouldShow={({ state }: { state: any }) => {
        const { from, to } = state.selection
        return from !== to && !editor.isActive('codeBlock')
      }}
    >
      <div className="flex items-center gap-0.5 px-1 py-1 bg-white/95 dark:bg-[#1C1C1F]/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 animate-in fade-in zoom-in duration-200">
        {/* 格式化工具 */}
        <div className="flex items-center px-1 border-r border-gray-100 dark:border-gray-800">
          <FormatButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            icon={<Bold className="h-3.5 w-3.5" />}
            label="加粗"
          />
          <FormatButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            icon={<Italic className="h-3.5 w-3.5" />}
            label="斜体"
          />
          <FormatButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            icon={<Strikethrough className="h-3.5 w-3.5" />}
            label="删除线"
          />
          <FormatButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            icon={<CodeIcon className="h-3.5 w-3.5" />}
            label="内联代码"
          />
          <FormatButton
            onClick={setLink}
            active={editor.isActive('link')}
            icon={<LinkIcon className="h-3.5 w-3.5" />}
            label="插入链接"
          />
        </div>

        {/* AI 统一入口 */}
        <button
          onClick={onOpenAIPrompt}
          className="flex items-center gap-1.5 px-2.5 py-1.5 mx-0.5 text-[11px] font-medium text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-lg transition-all"
          title="AI 编辑选中内容 (Ctrl+J)"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI</span>
          <kbd className="px-1 py-px text-[9px] text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">⌃J</kbd>
        </button>
      </div>
    </BubbleMenu>
  )
}

function FormatButton({ onClick, active, icon, label }: { onClick: () => void; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-all ${
        active
          ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 dark:text-indigo-300'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
      title={label}
    >
      {icon}
    </button>
  )
}
