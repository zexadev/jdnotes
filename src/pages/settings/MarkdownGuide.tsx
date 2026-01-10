import { useState } from 'react'
import { Copy, Check, BookOpen } from 'lucide-react'

interface SyntaxExample {
  title: string
  description: string
  markdown: string
  preview: string
}

const MARKDOWN_EXAMPLES: SyntaxExample[] = [
  {
    title: '标题',
    description: '使用 # 号表示标题，# 的数量代表标题级别',
    markdown: `# 一级标题
## 二级标题
### 三级标题
#### 四级标题`,
    preview: `<h1>一级标题</h1>
<h2>二级标题</h2>
<h3>三级标题</h3>
<h4>四级标题</h4>`
  },
  {
    title: '粗体和斜体',
    description: '使用星号或下划线强调文本',
    markdown: `**粗体文本**
*斜体文本*
***粗斜体文本***
~~删除线文本~~`,
    preview: `<strong>粗体文本</strong>
<em>斜体文本</em>
<strong><em>粗斜体文本</em></strong>
<del>删除线文本</del>`
  },
  {
    title: '列表',
    description: '无序列表使用 -、+ 或 *，有序列表使用数字加点',
    markdown: `无序列表：
- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2

有序列表：
1. 第一项
2. 第二项
3. 第三项`,
    preview: `无序列表：
• 项目 1
• 项目 2
  • 子项目 2.1
  • 子项目 2.2

有序列表：
1. 第一项
2. 第二项
3. 第三项`
  },
  {
    title: '链接',
    description: '创建可点击的链接',
    markdown: `[链接文字](https://example.com)
[带标题的链接](https://example.com "鼠标悬停显示")`,
    preview: `<a href="https://example.com">链接文字</a>
<a href="https://example.com" title="鼠标悬停显示">带标题的链接</a>`
  },
  {
    title: '图片',
    description: '插入图片（类似链接，但前面加 !）',
    markdown: `![图片描述](图片URL)
![示例图片](https://via.placeholder.com/150 "可选标题")`,
    preview: `图片将在编辑器中显示`
  },
  {
    title: '引用',
    description: '使用 > 创建引用块',
    markdown: `> 这是一段引用文字
>
> 可以有多行
>> 嵌套引用`,
    preview: `│ 这是一段引用文字
│
│ 可以有多行
│ │ 嵌套引用`
  },
  {
    title: '代码',
    description: '行内代码使用反引号，代码块使用三个反引号',
    markdown: `行内代码：\`console.log('Hello')\`

代码块：
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\``,
    preview: `行内代码：console.log('Hello')

代码块：
┌─────────────────────────┐
│ function greet(name) {  │
│   return \`Hello, \${name}!\`│
│ }                       │
└─────────────────────────┘`
  },
  {
    title: '表格',
    description: '使用 | 和 - 创建表格',
    markdown: `| 列1 | 列2 | 列3 |
|------|------|------|
| 数据1 | 数据2 | 数据3 |
| 数据4 | 数据5 | 数据6 |`,
    preview: `┌──────┬──────┬──────┐
│ 列1  │ 列2  │ 列3  │
├──────┼──────┼──────┤
│数据1 │数据2 │数据3 │
│数据4 │数据5 │数据6 │
└──────┴──────┴──────┘`
  },
  {
    title: '分隔线',
    description: '使用三个或以上的 -、* 或 _ 创建分隔线',
    markdown: `---
***
___`,
    preview: `─────────────────────
─────────────────────
─────────────────────`
  },
  {
    title: '任务列表',
    description: '创建可勾选的任务清单',
    markdown: `- [x] 已完成任务
- [ ] 未完成任务
- [ ] 待办事项`,
    preview: `☑ 已完成任务
☐ 未完成任务
☐ 待办事项`
  },
  {
    title: '高亮',
    description: '使用 == 高亮文本',
    markdown: `这是 ==高亮文本== 的示例`,
    preview: `这是 [高亮文本] 的示例`
  },
  {
    title: '脚注',
    description: '添加脚注引用',
    markdown: `这是一段文字[^1]

[^1]: 这是脚注内容`,
    preview: `这是一段文字[1]

[1]: 这是脚注内容`
  }
]

export function MarkdownGuide() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#5E6AD2]" />
          Markdown 语法指南
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          快速掌握 Markdown 标记语言，让你的笔记更加美观和结构化
        </p>
      </div>

      {/* 简介 */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
          什么是 Markdown？
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
          Markdown 是一种轻量级标记语言，使用简单的符号来格式化文本。
          它让你可以专注于内容创作，而不用担心复杂的排版。在 JD Notes 中，
          你可以使用 Markdown 语法来创建结构清晰、格式美观的笔记。
        </p>
      </div>

      {/* 语法示例 */}
      <div className="space-y-4">
        {MARKDOWN_EXAMPLES.map((example, index) => (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/50"
          >
            {/* 标题 */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {example.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {example.description}
              </p>
            </div>

            {/* 内容 */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
              {/* Markdown 语法 */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Markdown 语法
                  </span>
                  <button
                    onClick={() => copyToClipboard(example.markdown, index)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="复制代码"
                  >
                    {copiedIndex === index ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono bg-gray-50 dark:bg-gray-900/50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
                  {example.markdown}
                </pre>
              </div>

              {/* 预览效果 */}
              <div className="p-4">
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    显示效果
                  </span>
                </div>
                <div className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 p-3 rounded overflow-x-auto">
                  <pre className="whitespace-pre-wrap break-words font-sans">
                    {example.preview}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快捷提示 */}
      <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-sm font-medium text-green-800 dark:text-green-300 mb-3">
          💡 编辑器快捷提示
        </h3>
        <ul className="space-y-2 text-sm text-green-700 dark:text-green-300">
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>在编辑模式下输入 Markdown 语法，实时预览会自动显示格式化效果</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>切换到阅读模式可以看到最终的渲染效果</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>点击上方的复制按钮可以快速复制语法示例到你的笔记中试试</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>可以混合使用多种 Markdown 语法来创建丰富的笔记内容</span>
          </li>
        </ul>
      </div>

      {/* 学习资源 */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
        <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-3">
          📚 推荐学习资源
        </h3>
        <ul className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>
              <a
                href="https://markdown.com.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-purple-900 dark:hover:text-purple-200"
              >
                Markdown 中文网
              </a> - 完整的中文教程
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>
              <a
                href="https://www.markdownguide.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-purple-900 dark:hover:text-purple-200"
              >
                Markdown Guide
              </a> - 官方权威指南（英文）
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1">•</span>
            <span>尝试在笔记中实践，熟能生巧！</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
