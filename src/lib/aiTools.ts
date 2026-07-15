/**
 * AI Tools 定义与执行
 * 为 AI 模型提供操作笔记的工具能力
 *
 * 设计约束：
 * - 一切返回笔记的地方必须带 id——模型靠 id 串联 read/update/append/delete，
 *   缺 id 的搜索结果是断链（模型搜到了却无法操作）
 * - 长内容一律截断并明确告知（含 offset 分页），否则长笔记会淹没模型上下文
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

// 单次工具结果里笔记正文的最大字符数（超出截断，模型可用 offset 续读）
const CONTENT_CLIP = 8000

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'list_notes',
    description: '列出笔记清单（id、标题、标签、字数、更新时间），按更新时间倒序。想了解用户有哪些笔记时先用这个。',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回条数，默认 50' },
        offset: { type: 'number', description: '跳过条数（分页用），默认 0' },
      },
    },
  },
  {
    name: 'read_current_note',
    description: '读取当前打开笔记的内容（含 id）。超长内容会截断，可用 offset 继续读。',
    parameters: {
      type: 'object',
      properties: {
        offset: { type: 'number', description: '从正文第几个字符开始读（截断续读用），默认 0' },
      },
    },
  },
  {
    name: 'read_note',
    description: '读取指定笔记。提供 note_id（推荐，从 list/search 结果获取）或 title（先精确后模糊匹配；多个命中会返回候选列表）。超长内容会截断，可用 offset 继续读。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID（优先使用）' },
        title: { type: 'string', description: '按标题查找（没有 id 时用）' },
        offset: { type: 'number', description: '从正文第几个字符开始读，默认 0' },
      },
    },
  },
  {
    name: 'search_notes',
    description: '按关键词搜索笔记（匹配标题和内容），返回带 id 的结果列表。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
      },
      required: ['query'],
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
    description: '获取指定标签下的所有笔记列表（带 id）',
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
    description: '创建一个新笔记，返回新笔记的 id',
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
    name: 'append_note',
    description: '在指定笔记末尾追加内容（不改动原有内容）。往已有笔记补充信息时优先用这个，不要用 update_note 整篇重写。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID' },
        content: { type: 'string', description: '要追加的内容（Markdown 格式）' },
      },
      required: ['note_id', 'content'],
    },
  },
  {
    name: 'update_note',
    description: '整体替换笔记的标题、内容或标签（content 会完全覆盖原文——只是追加请用 append_note）。改前建议先 read_note 确认现状。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID' },
        title: { type: 'string', description: '新标题（不传则不修改）' },
        content: { type: 'string', description: '新内容，完全覆盖原文（不传则不修改）' },
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
    description: '查看笔记里包含哪些图片（数量与引用，不返回图片数据）',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'number', description: '笔记 ID（不传则查当前笔记）' },
      },
    },
  },
  {
    name: 'web_search',
    description: '搜索互联网，获取最新信息、资料和参考内容（返回前 8 条结果的标题/链接/摘要）。关键词精简效果最好，堆砌日期/多余词会拉低相关性；查天气、实时数据、英文资料时用英文关键词命中更准（如 "Los Angeles weather today"）。拿到相关链接后可用 web_fetch 读取正文。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，精简为准' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: '读取指定网页的正文文本（最多约 8000 字符）',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '网页 URL' },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_location',
    description: '获取用户的大致地理位置（城市、省份、国家），基于 IP 定位',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
]

// ============= 工具执行 =============

// 正文截断：明确告诉模型截了多少、怎么续读
function clipContent(content: string, offset = 0): { content: string; truncated: boolean; totalChars: number; offset: number } {
  const total = content.length
  const start = Math.max(0, Math.min(offset, total))
  const clipped = content.slice(start, start + CONTENT_CLIP)
  return {
    content: clipped,
    truncated: start + clipped.length < total,
    totalChars: total,
    offset: start,
  }
}

function noteReadResult(note: { id: number; title: string; content: string; tags: string[]; createdAt: Date; updatedAt: Date }, offset = 0): string {
  const clip = clipContent(note.content, offset)
  return JSON.stringify({
    id: note.id,
    title: note.title,
    content: clip.content,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    ...(clip.truncated || clip.offset > 0
      ? {
          content_range: `第 ${clip.offset} 到 ${clip.offset + clip.content.length} 字符，全文共 ${clip.totalChars} 字符`,
          ...(clip.truncated ? { hint: `内容未完，用 offset=${clip.offset + clip.content.length} 继续读` } : {}),
        }
      : {}),
  })
}

function noteSummary(n: { id: number; title: string; content: string; tags: string[]; updatedAt: Date }) {
  return {
    id: n.id,
    title: n.title,
    preview: n.content.slice(0, 200),
    tags: n.tags,
    updatedAt: n.updatedAt,
  }
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
      case 'list_notes': {
        const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200)
        const offset = Math.max(Number(params.offset) || 0, 0)
        const allNotes = (await noteOperations.getAll()).filter(n => n.isDeleted === 0)
        const page = allNotes.slice(offset, offset + limit).map(n => ({
          id: n.id,
          title: n.title,
          tags: n.tags,
          chars: n.content.length,
          updatedAt: n.updatedAt,
        }))
        return JSON.stringify({ total: allNotes.length, offset, notes: page })
      }

      case 'read_current_note': {
        if (!context.currentNoteId) return '当前没有打开的笔记'
        const note = await noteOperations.get(context.currentNoteId)
        if (!note) return '笔记不存在'
        return noteReadResult(note, Number(params.offset) || 0)
      }

      case 'read_note': {
        const noteId = params.note_id as number | undefined
        const title = (params.title as string | undefined)?.trim()
        const offset = Number(params.offset) || 0

        if (noteId) {
          const note = await noteOperations.get(noteId)
          if (!note) return `ID 为 ${noteId} 的笔记不存在，可用 list_notes 或 search_notes 查找正确的 id`
          return noteReadResult(note, offset)
        }

        if (title) {
          const candidates = (await noteOperations.getAll()).filter(n => n.isDeleted === 0)
          const exact = candidates.filter(n => n.title === title)
          const fuzzy = exact.length > 0 ? exact : candidates.filter(n => n.title.toLowerCase().includes(title.toLowerCase()))
          if (fuzzy.length === 0) return `没有标题匹配「${title}」的笔记，可用 search_notes 搜索内容`
          if (fuzzy.length > 1) {
            return JSON.stringify({
              message: `有 ${fuzzy.length} 条笔记标题匹配「${title}」，请用 note_id 指定`,
              candidates: fuzzy.slice(0, 10).map(n => ({ id: n.id, title: n.title, updatedAt: n.updatedAt })),
            })
          }
          return noteReadResult(fuzzy[0], offset)
        }

        return '请提供 note_id 或 title'
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
          .map(noteSummary)
        return results.length > 0
          ? JSON.stringify({ count: results.length, notes: results })
          : `没有找到包含「${query}」的笔记`
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
          .map(noteSummary)
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

      case 'append_note': {
        const noteId = params.note_id as number
        const content = params.content as string
        if (!noteId) return '请提供笔记 ID'
        if (!content) return '请提供要追加的内容'
        const note = await noteOperations.get(noteId)
        if (!note) return `ID 为 ${noteId} 的笔记不存在`
        const merged = note.content ? `${note.content}\n\n${content}` : content
        await noteOperations.update(noteId, { content: merged })
        return JSON.stringify({ success: true, id: noteId, message: `已追加到笔记「${note.title}」末尾` })
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

        return JSON.stringify({ success: true, id: noteId, message: `笔记「${note.title}」已更新` })
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
        // 图片有两种形态：附件引用 attachment://<hash>（当前主形态）与内嵌 base64
        const attachmentRefs = [...note.content.matchAll(/!\[[^\]]*\]\(attachment:\/\/([a-f0-9]+)/g)].map(m => m[1])
        const base64Count = (note.content.match(/!\[[^\]]*\]\(data:image\//g) || []).length
        return JSON.stringify({
          id: noteId,
          title: note.title,
          imageCount: attachmentRefs.length + base64Count,
          attachments: attachmentRefs,
          note: '图片数据无法在对话中直接查看',
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

      case 'get_location': {
        try {
          const result = await invoke<string>('get_location')
          return result
        } catch (e) {
          return `获取位置失败: ${e instanceof Error ? e.message : e}`
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
 * Gemini 对 properties 为空的 OBJECT schema 会报 400，无参工具必须省略 parameters
 */
export function toGeminiTools(): object[] {
  return [{
    functionDeclarations: AI_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      ...(Object.keys(tool.parameters.properties).length > 0 ? { parameters: tool.parameters } : {}),
    })),
  }]
}

/**
 * 转换为 Responses API tools 格式
 */
export function toResponsesTools(): object[] {
  return AI_TOOLS.map(tool => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}
