import { useState, useEffect, useMemo } from 'react'
import { X, Download, Search, Check, FileText, FileJson, Archive } from 'lucide-react'
import { noteOperations, type Note } from '../../lib/db'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { toast } from '../../lib/toast'

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

type ExportFormat = 'markdown' | 'json'

// 生成 Markdown 内容
function generateMarkdown(note: Note): string {
  let markdown = `# ${note.title}\n\n`
  
  if (note.tags && note.tags.length > 0) {
    markdown += `> 标签：${note.tags.join(', ')}\n\n`
  }
  
  markdown += `> 创建时间：${note.createdAt.toLocaleString()}\n\n`
  markdown += `---\n\n`
  markdown += note.content
  
  return markdown
}

// 生成合并的 Markdown 内容
function generateCombinedMarkdown(notes: Note[]): string {
  return notes.map((note, index) => {
    let markdown = generateMarkdown(note)
    if (index < notes.length - 1) {
      markdown += '\n\n---\n\n---\n\n'
    }
    return markdown
  }).join('')
}

// 生成 JSON 导出内容
function generateJSON(notes: Note[]): string {
  const exportData = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    count: notes.length,
    notes: notes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags,
      isFavorite: note.isFavorite,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      reminderDate: note.reminderDate?.toISOString() || null,
      reminderEnabled: note.reminderEnabled,
    }))
  }
  
  return JSON.stringify(exportData, null, 2)
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // 加载笔记列表
  useEffect(() => {
    if (open) {
      loadNotes()
    }
  }, [open])

  const loadNotes = async () => {
    setIsLoading(true)
    try {
      const allNotes = await noteOperations.getAll()
      // 只显示未删除的笔记
      const activeNotes = allNotes.filter(n => n.isDeleted === 0)
      setNotes(activeNotes)
    } catch (e) {
      console.error('Failed to load notes:', e)
      toast.error('加载笔记失败')
    }
    setIsLoading(false)
  }

  // 搜索过滤
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes
    
    const query = searchQuery.toLowerCase()
    return notes.filter(note => 
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  }, [notes, searchQuery])

  // 切换选择
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNotes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredNotes.map(n => n.id)))
    }
  }

  // 获取选中的笔记
  const selectedNotes = useMemo(() => {
    return notes.filter(n => selectedIds.has(n.id))
  }, [notes, selectedIds])

  // 导出处理
  const handleExport = async () => {
    if (selectedNotes.length === 0) {
      toast.error('请至少选择一篇笔记')
      return
    }

    setIsExporting(true)
    
    try {
      if (exportFormat === 'markdown') {
        if (selectedNotes.length === 1) {
          // 单个笔记导出为单个 md 文件
          const note = selectedNotes[0]
          const content = generateMarkdown(note)
          const filename = `${note.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`
          
          const filePath = await save({
            filters: [{ name: 'Markdown', extensions: ['md'] }],
            defaultPath: filename
          })
          
          if (filePath) {
            await writeTextFile(filePath, content)
            toast.success('导出成功！')
            onClose()
          }
        } else {
          // 多个笔记合并导出为单个 md 文件
          const content = generateCombinedMarkdown(selectedNotes)
          const filename = `jdnotes-export-${new Date().toISOString().split('T')[0]}.md`
          
          const filePath = await save({
            filters: [{ name: 'Markdown', extensions: ['md'] }],
            defaultPath: filename
          })
          
          if (filePath) {
            await writeTextFile(filePath, content)
            toast.success(`成功导出 ${selectedNotes.length} 篇笔记！`)
            onClose()
          }
        }
      } else {
        // JSON 格式导出
        const content = generateJSON(selectedNotes)
        const filename = `jdnotes-export-${new Date().toISOString().split('T')[0]}.json`
        
        const filePath = await save({
          filters: [{ name: 'JSON', extensions: ['json'] }],
          defaultPath: filename
        })
        
        if (filePath) {
          await writeTextFile(filePath, content)
          toast.success(`成功导出 ${selectedNotes.length} 篇笔记！`)
          onClose()
        }
      }
    } catch (e) {
      console.error('Export failed:', e)
      toast.error('导出失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    
    setIsExporting(false)
  }

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set())
      setSearchQuery('')
      setExportFormat('markdown')
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 模态框 */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[85vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-[#5E6AD2]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              导出笔记
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 space-y-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索笔记..."
              className="w-full pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-[#5E6AD2] focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* 选择和格式控制 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* 全选 */}
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedIds.size === filteredNotes.length && filteredNotes.length > 0
                    ? 'bg-[#5E6AD2] border-[#5E6AD2]'
                    : selectedIds.size > 0
                    ? 'bg-[#5E6AD2]/50 border-[#5E6AD2]'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selectedIds.size > 0 && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                {selectedIds.size === filteredNotes.length && filteredNotes.length > 0 ? '取消全选' : '全选'}
              </button>

              <span className="text-sm text-gray-500 dark:text-gray-400">
                已选择 <span className="font-medium text-[#5E6AD2]">{selectedIds.size}</span> / {filteredNotes.length} 篇
              </span>
            </div>

            {/* 导出格式 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">格式：</span>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setExportFormat('markdown')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    exportFormat === 'markdown'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Markdown
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    exportFormat === 'json'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <FileJson className="h-3.5 w-3.5" />
                  JSON
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 笔记列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5E6AD2]" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {searchQuery ? '没有找到匹配的笔记' : '暂无笔记'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => toggleSelect(note.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedIds.has(note.id)
                      ? 'bg-[#5E6AD2]/10 dark:bg-[#5E6AD2]/20 border border-[#5E6AD2]/30'
                      : 'bg-gray-50 dark:bg-gray-800/50 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {/* 选择框 */}
                  <div className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedIds.has(note.id)
                      ? 'bg-[#5E6AD2] border-[#5E6AD2]'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedIds.has(note.id) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>

                  {/* 笔记信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {note.title || '无标题'}
                      </h3>
                      {note.isFavorite === 1 && (
                        <span className="text-yellow-500 text-xs">⭐</span>
                      )}
                    </div>
                    
                    {/* 标签 */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {note.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {note.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400">
                            +{note.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* 内容预览 */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {note.content.replace(/<[^>]*>/g, '').slice(0, 100) || '暂无内容'}
                    </p>
                    
                    {/* 时间 */}
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      更新于 {note.updatedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {exportFormat === 'markdown' 
              ? selectedNotes.length > 1 
                ? '多篇笔记将合并为一个 Markdown 文件' 
                : '导出为 Markdown 文件'
              : '导出为 JSON 格式，可重新导入'}
          </p>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={selectedIds.size === 0 || isExporting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  导出 ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
