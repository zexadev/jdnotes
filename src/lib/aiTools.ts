/**
 * AI Tools 定义与执行
 * 为 AI 模型提供操作笔记的工具能力
 */
import { noteOperations } from './db'
import { invoke } from '@tauri-apps/api/core'

// ============= 工具定义 =============

export interface ToolParameter {
  type: string
  description: string
  enum?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}

// AI 执行上下文
export interface AIToolContext {
  currentNoteId: number | null
  currentNoteTitle: string
  currentNoteContent: string
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'read_current_note',
    description: '读取当前笔记的完整内容（标题、正文、标签）',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_notes',
    description: '按关键词搜索笔记（匹配标题和内容）',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_note',
    description: '按 ID 读取指定笔记的完整内容',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID' },
      },
      required: ['note_id'],
    },
  },
  {
    name: 'list_tags',
    description: '列出所有标签及每个标签下的笔记数量',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_notes_by_tag',
    description: '获取指定标签下的所有笔记列表',
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: '标签名称' },
      },
      required: ['tag'],
    },
  },
  {
    name: 'create_note',
    description: '创建一个新笔记',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '笔记标题' },
        content: { type: 'string', description: '笔记内容（Markdown 格式）' },
        tags: { type: 'string', description: '标签，用逗号分隔，如 "工作,编程"' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'update_note',
    description: '修改指定笔记的标题、内容或标签',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID' },
        title: { type: 'string', description: '新标题（不传则不修改）' },
        content: { type: 'string', description: '新内容（不传则不修改）' },
        tags: { type: 'string', description: '新标签，用逗号分隔（不传则不修改）' },
      },
      required: ['note_id'],
    },
  },
  {
    name: 'delete_note',
    description: '删除笔记（移到废纸篓，可恢复）',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID' },
      },
      required: ['note_id'],
    },
  },
  {
    name: 'get_note_images',
    description: '获取笔记中嵌入的图片列表（返回 base64 数据）',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID（不传则获取当前笔记的图片）' },
      },
    },
  },
  {
    name: 'web_search',
    description: '搜索互联网，获取最新信息、资料和参考内容',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: '读取指定网页的内容（返回 Markdown 格式的正文）',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '网页 URL' },
      },
      required: ['url'],
    },
  },
]

// ============= 工具执行 =============

/**
 * 从笔记内容中提取 base64 图片
 */
function extractImagesFromContent(content: string): string[] {
  const regex = /!\[.*?\]\((data:image\/[^)]+)\)/g
  const images: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    images.push(match[1])
  }
  return images
}

/**
 * 执行工具调用
 */
export async function executeToolCall(
  toolName: string,
  params: Record<string, unknown>,
  context: AIToolContext
): Promise<string> {
  try {
    switch (toolName) {
      case 'read_current_note': {
        if (!context.currentNoteId) return '当前没有打开的笔记'
        const note = await noteOperations.get(context.currentNoteId)
        if (!note) return '笔记不存在'
        return JSON.stringify({
          title: note.title,
          content: note.content,
          tags: note.tags,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })
      }

      case 'search_notes': {
        const query = params.query as string
        if (!query) return '请提供搜索关键词'
        const allNotes = await noteOperations.getAll()
        const results = allNotes
          .filter(n => n.isDeleted === 0)
          .filter(n =>
            n.title.toLowerCase().includes(query.toLowerCase()) ||
            n.content.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 20)
          .map(n => ({
            title: n.title,
            preview: n.content.slice(0, 200),
            tags: n.tags,
            updatedAt: n.updatedAt,
          }))
        return results.length > 0
          ? JSON.stringify({ count: results.length, notes: results })
          : `没有找到包含「${query}」的笔记`
      }

      case 'read_note': {
        const noteId = params.note_id as number
        if (!noteId) return '请提供笔记 ID'
        const note = await noteOperations.get(noteId)
        if (!note) return `ID 为 ${noteId} 的笔记不存在`
        return JSON.stringify({
          title: note.title,
          content: note.content,
          tags: note.tags,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        })
      }

      case 'list_tags': {
        const tags = await noteOperations.getAllTags()
        const allNotes = await noteOperations.getAll()
        const tagCounts = tags.map(tag => ({
          tag,
          count: allNotes.filter(n => n.isDeleted === 0 && n.tags.includes(tag)).length,
        }))
        return JSON.stringify(tagCounts)
      }

      case 'get_notes_by_tag': {
        const tag = params.tag as string
        if (!tag) return '请提供标签名称'
        const allNotes = await noteOperations.getAll()
        const results = allNotes
          .filter(n => n.isDeleted === 0 && n.tags.includes(tag))
          .map(n => ({
            title: n.title,
            preview: n.content.slice(0, 200),
            tags: n.tags,
            updatedAt: n.updatedAt,
          }))
        return JSON.stringify({ count: results.length, notes: results })
      }

      case 'create_note': {
        const title = params.title as string
        const content = params.content as string
        const tagsStr = params.tags as string | undefined
        if (!title || !content) return '请提供标题和内容'
        const id = await noteOperations.create(title, content)
        if (tagsStr) {
          const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean)
          await noteOperations.updateTags(id, tags)
        }
        return JSON.stringify({ success: true, id, message: `笔记「${title}」已创建` })
      }

      case 'update_note': {
        const noteId = params.note_id as number
        if (!noteId) return '请提供笔记 ID'
        const note = await noteOperations.get(noteId)
        if (!note) return `ID 为 ${noteId} 的笔记不存在`

        const updateData: Partial<{ title: string; content: string }> = {}
        if (params.title) updateData.title = params.title as string
        if (params.content) updateData.content = params.content as string

        if (Object.keys(updateData).length > 0) {
          await noteOperations.update(noteId, updateData)
        }

        if (params.tags) {
          const tags = (params.tags as string).split(',').map(t => t.trim()).filter(Boolean)
          await noteOperations.updateTags(noteId, tags)
        }

        return JSON.stringify({ success: true, message: `笔记「${note.title}」已更新` })
      }

      case 'delete_note': {
        const noteId = params.note_id as number
        if (!noteId) return '请提供笔记 ID'
        const note = await noteOperations.get(noteId)
        if (!note) return `ID 为 ${noteId} 的笔记不存在`
        await noteOperations.softDelete(noteId)
        return JSON.stringify({ success: true, message: `笔记「${note.title}」已移到废纸篓` })
      }

      case 'get_note_images': {
        const noteId = (params.note_id as number) || context.currentNoteId
        if (!noteId) return '请提供笔记 ID 或打开一个笔记'
        const note = await noteOperations.get(noteId)
        if (!note) return `笔记不存在`
        const images = extractImagesFromContent(note.content)
        return JSON.stringify({
          noteId,
          title: note.title,
          imageCount: images.length,
          images: images.slice(0, 5), // 最多返回 5 张，避免上下文过大
        })
      }

      case 'web_search': {
        const query = params.query as string
        if (!query) return '请提供搜索关键词'
        try {
          const result = await invoke<string>('web_search', { query })
          return result
        } catch (e) {
          return `搜索失败: ${e instanceof Error ? e.message : e}`
        }
      }

      case 'web_fetch': {
        const url = params.url as string
        if (!url) return '请提供网页 URL'
        try {
          const result = await invoke<string>('web_fetch', { url })
          return result
        } catch (e) {
          return `读取网页失败: ${e instanceof Error ? e.message : e}`
        }
      }

      default:
        return `未知工具: ${toolName}`
    }
  } catch (error) {
    return `工具执行出错: ${error instanceof Error ? error.message : '未知错误'}`
  }
}

// ============= Provider 格式转换 =============

/**
 * 转换为 OpenAI tools 格式
 */
export function toOpenAITools(): object[] {
  return AI_TOOLS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

/**
 * 转换为 Anthropic tools 格式
 */
export function toAnthropicTools(): object[] {
  return AI_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }))
}

/**
 * 转换为 Google Gemini tools 格式
 */
export function toGeminiTools(): object[] {
  return [{
    functionDeclarations: AI_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  }]
}
