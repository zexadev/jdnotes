/**
 * SQLite 数据库实现 (使用 tauri-plugin-sql)
 * 替代原有的 IndexedDB (Dexie.js) 实现
 */
import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'

// 数据库实例
let database: Database | null = null

// 笔记数据类型
export interface Note {
  id: number
  title: string
  content: string
  tags: string[] // 标签数组
  isFavorite: number // 0 或 1
  isDeleted: number // 0 或 1
  createdAt: Date
  updatedAt: Date
  // 日历提醒相关字段
  reminderDate?: Date // 提醒日期时间
  reminderEnabled?: number // 0 或 1，是否启用提醒
}

// SQLite 返回的原始行数据类型
interface NoteRow {
  id: number
  title: string
  content: string
  tags: string // JSON 字符串
  is_favorite: number
  is_deleted: number
  created_at: string
  updated_at: string
  reminder_date: string | null
  reminder_enabled: number
}

// 聊天消息数据类型
export interface ChatMessage {
  id: number
  noteId: number
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// SQLite 返回的聊天消息原始数据
interface ChatMessageRow {
  id: number
  note_id: number
  role: string
  content: string
  timestamp: string
}

/**
 * 将 SQLite 行数据转换为 Note 对象
 */
function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags || '[]'),
    isFavorite: row.is_favorite,
    isDeleted: row.is_deleted,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    reminderDate: row.reminder_date ? new Date(row.reminder_date) : undefined,
    reminderEnabled: row.reminder_enabled,
  }
}

/**
 * 将 SQLite 行数据转换为 ChatMessage 对象
 */
function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    noteId: row.note_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    timestamp: new Date(row.timestamp),
  }
}

/**
 * 获取数据库实例
 */
async function getDatabase(): Promise<Database> {
  if (database) return database
  
  // 获取数据库 URL
  const dbUrl = await invoke<string>('get_database_url')
  database = await Database.load(dbUrl)
  return database
}

/**
 * 初始化数据库连接
 */
export async function initDatabase(): Promise<void> {
  await getDatabase()
}

// 防止重复初始化的标志
let isInitializing = false

/**
 * 初始化默认数据（仅在数据库为空时）
 */
export async function initializeDefaultNotes(): Promise<void> {
  if (isInitializing) return
  isInitializing = true

  try {
    const db = await getDatabase()
    const result = await db.select<[{ count: number }]>('SELECT COUNT(*) as count FROM notes')
    const count = result[0]?.count || 0
    
    if (count > 0) return

    const now = new Date().toISOString()
    
    // 插入欢迎笔记
    await db.execute(
      `INSERT INTO notes (title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_enabled)
       VALUES (?, ?, ?, 0, 0, ?, ?, 0)`,
      [
        '欢迎使用 JD Notes',
        `欢迎使用 JD Notes！这是一个 Linear 风格的笔记应用。

## 功能特性

- **富文本编辑**：支持 Markdown 语法
- **代码块**：语法高亮，支持运行 Shell 命令
- **自动保存**：本地持久化存储
- **AI 智能助手**：右键菜单 + 侧栏对话
- **斜杠命令**：快速调用 AI 模板
- **日历视图**：按时间维度管理笔记
- **笔记提醒**：设置提醒，到期通知
- **SQLite 存储**：数据可备份迁移

## 快速开始

1. 点击左上角 **+ 新建笔记** 创建笔记
2. 按 \`Ctrl+K\` 搜索已有笔记
3. 按 \`Ctrl+J\` 打开 AI 助手
4. 点击侧栏 **📅 日历** 查看时间轴

开始创建你的第一个笔记吧！`,
        '["入门"]',
        now,
        now
      ]
    )

    // 插入快捷键指南
    await db.execute(
      `INSERT INTO notes (title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_enabled)
       VALUES (?, ?, ?, 0, 0, ?, ?, 0)`,
      [
        '快捷键指南',
        `## 编辑器快捷键

- \`Ctrl+B\` - 粗体
- \`Ctrl+I\` - 斜体
- \`Ctrl+Shift+C\` - 代码块

## 通用快捷键

- \`Ctrl+K\` - 搜索笔记
- \`Ctrl+J\` - 打开/关闭 AI 助手侧栏

## AI 功能

**右键菜单**：在编辑器中右键即可呼出 AI 助手菜单
- 选中文本：改进写作、总结摘要、中英互译
- 任意位置：AI 续写、自由提问

**斜杠命令**：输入 \`/\` 触发快捷模板
- AI 续写 - 根据上文继续写作
- 会议纪要 - 生成结构化会议模板
- 脑暴大纲 - 生成 5 点思维大纲
- 代码实现 - 根据描述生成代码

**AI 侧栏**：按 \`Ctrl+J\` 打开，可与 AI 自由对话，AI 会自动获取当前笔记上下文

## 日历视图

点击侧栏 **📅 日历** 进入日历视图：
- **月视图**：查看整月笔记分布，支持热力图显示
- **周视图**：查看一周笔记详情
- **日视图**：查看单日笔记，支持设置提醒

## 提醒功能

在笔记编辑界面，点击工具栏的 **🔔 铃铛按钮** 设置提醒：
- 快捷选项：30分钟后、1小时后、3小时后、明天此时
- 自定义时间：选择任意时间
- 到期通知：浏览器弹窗 + 系统通知`,
        '["入门", "快捷键"]',
        now,
        now
      ]
    )
  } finally {
    isInitializing = false
  }
}

// 笔记操作函数
export const noteOperations = {
  // 创建新笔记
  async create(title: string = '无标题', content: string = ''): Promise<number> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    const result = await db.execute(
      `INSERT INTO notes (title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_enabled)
       VALUES (?, ?, '[]', 0, 0, ?, ?, 0)`,
      [title, content, now, now]
    )
    
    return result.lastInsertId ?? 0
  },

  // 更新笔记
  async update(
    id: number,
    data: Partial<Pick<Note, 'title' | 'content'>>
  ): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    const updates: string[] = ['updated_at = ?']
    const params: (string | number)[] = [now]
    
    if (data.title !== undefined) {
      updates.push('title = ?')
      params.push(data.title)
    }
    
    if (data.content !== undefined) {
      updates.push('content = ?')
      params.push(data.content)
    }
    
    params.push(id)
    
    await db.execute(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`,
      params
    )
  },

  // 切换收藏状态（不更新 updatedAt，因为收藏是元数据操作，不是内容修改）
  async toggleFavorite(id: number): Promise<void> {
    const db = await getDatabase()
    
    await db.execute(
      `UPDATE notes SET is_favorite = 1 - is_favorite WHERE id = ?`,
      [id]
    )
  },

  // 软删除（移到废纸篓）
  async softDelete(id: number): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.execute(
      `UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?`,
      [now, id]
    )
  },

  // 恢复笔记
  async restore(id: number): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.execute(
      `UPDATE notes SET is_deleted = 0, updated_at = ? WHERE id = ?`,
      [now, id]
    )
  },

  // 彻底删除
  async permanentDelete(id: number): Promise<void> {
    const db = await getDatabase()
    
    // 先删除相关的聊天消息
    await db.execute('DELETE FROM chat_messages WHERE note_id = ?', [id])
    // 再删除笔记
    await db.execute('DELETE FROM notes WHERE id = ?', [id])
  },

  // 获取单个笔记
  async get(id: number): Promise<Note | undefined> {
    const db = await getDatabase()
    const rows = await db.select<NoteRow[]>(
      'SELECT * FROM notes WHERE id = ?',
      [id]
    )
    return rows.length > 0 ? rowToNote(rows[0]) : undefined
  },

  // 获取所有笔记（按更新时间倒序）
  async getAll(): Promise<Note[]> {
    const db = await getDatabase()
    const rows = await db.select<NoteRow[]>(
      'SELECT * FROM notes ORDER BY updated_at DESC'
    )
    return rows.map(rowToNote)
  },

  // 更新标签
  async updateTags(id: number, tags: string[]): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.execute(
      `UPDATE notes SET tags = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(tags), now, id]
    )
  },

  // 获取所有唯一标签
  async getAllTags(): Promise<string[]> {
    const db = await getDatabase()
    const rows = await db.select<{ tags: string }[]>(
      'SELECT tags FROM notes WHERE is_deleted = 0'
    )
    
    const tagSet = new Set<string>()
    rows.forEach((row: { tags: string }) => {
      const tags: string[] = JSON.parse(row.tags || '[]')
      tags.forEach((tag: string) => tagSet.add(tag))
    })
    
    return Array.from(tagSet).sort()
  },

  // ============= 日历相关方法 =============

  // 获取指定日期范围的笔记
  async getByDateRange(
    startDate: Date,
    endDate: Date,
    dateField: 'createdAt' | 'updatedAt' = 'createdAt'
  ): Promise<Note[]> {
    const db = await getDatabase()
    const column = dateField === 'createdAt' ? 'created_at' : 'updated_at'
    
    const rows = await db.select<NoteRow[]>(
      `SELECT * FROM notes 
       WHERE ${column} >= ? AND ${column} <= ? AND is_deleted = 0 
       ORDER BY ${column} ASC`,
      [startDate.toISOString(), endDate.toISOString()]
    )
    
    return rows.map(rowToNote)
  },

  // 获取指定日期的笔记
  async getByDate(
    date: Date,
    dateField: 'createdAt' | 'updatedAt' = 'createdAt'
  ): Promise<Note[]> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return this.getByDateRange(startOfDay, endOfDay, dateField)
  },

  // 获取笔记的日期分布统计
  async getDateDistribution(
    startDate: Date,
    endDate: Date,
    dateField: 'createdAt' | 'updatedAt' = 'createdAt'
  ): Promise<Map<string, number>> {
    const notes = await this.getByDateRange(startDate, endDate, dateField)
    const distribution = new Map<string, number>()

    notes.forEach((note) => {
      const dateKey = formatDateKey(note[dateField] as Date)
      distribution.set(dateKey, (distribution.get(dateKey) || 0) + 1)
    })

    return distribution
  },

  // 更新笔记的创建时间（用于拖拽功能）
  async updateCreatedAt(id: number, newDate: Date): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.execute(
      `UPDATE notes SET created_at = ?, updated_at = ? WHERE id = ?`,
      [newDate.toISOString(), now, id]
    )
  },

  // ============= 提醒相关方法 =============

  // 设置提醒
  async setReminder(id: number, reminderDate: Date): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.execute(
      `UPDATE notes SET reminder_date = ?, reminder_enabled = 1, updated_at = ? WHERE id = ?`,
      [reminderDate.toISOString(), now, id]
    )
  },

  // 清除提醒
  async clearReminder(id: number): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.execute(
      `UPDATE notes SET reminder_date = NULL, reminder_enabled = 0, updated_at = ? WHERE id = ?`,
      [now, id]
    )
  },

  // 获取即将到期的提醒（提前 X 分钟到提前 Y 分钟之间）
  async getUpcomingReminders(withinMinutes: number = 10, fromMinutes: number = 0): Promise<Note[]> {
    const db = await getDatabase()
    const now = new Date()
    const fromTime = new Date(now.getTime() + fromMinutes * 60 * 1000)
    const toTime = new Date(now.getTime() + withinMinutes * 60 * 1000)

    const rows = await db.select<NoteRow[]>(
      `SELECT * FROM notes
       WHERE reminder_enabled = 1
       AND is_deleted = 0
       AND reminder_date IS NOT NULL
       AND reminder_date >= ?
       AND reminder_date <= ?
       ORDER BY reminder_date ASC`,
      [fromTime.toISOString(), toTime.toISOString()]
    )

    return rows.map(rowToNote)
  },

  // 获取已到期的提醒（过去 X 分钟内到期的）
  async getDueReminders(withinMinutes: number = 1): Promise<Note[]> {
    const db = await getDatabase()
    const now = new Date()
    const pastTime = new Date(now.getTime() - withinMinutes * 60 * 1000)

    const rows = await db.select<NoteRow[]>(
      `SELECT * FROM notes
       WHERE reminder_enabled = 1
       AND is_deleted = 0
       AND reminder_date IS NOT NULL
       AND reminder_date >= ?
       AND reminder_date <= ?
       ORDER BY reminder_date ASC`,
      [pastTime.toISOString(), now.toISOString()]
    )

    return rows.map(rowToNote)
  },

  // 获取所有启用提醒的笔记
  async getNotesWithReminders(): Promise<Note[]> {
    const db = await getDatabase()
    
    const rows = await db.select<NoteRow[]>(
      `SELECT * FROM notes 
       WHERE reminder_enabled = 1 AND is_deleted = 0 
       ORDER BY reminder_date ASC`
    )

    return rows.map(rowToNote)
  },
}

// 辅助函数：格式化日期为 YYYY-MM-DD（使用本地时间）
export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 聊天消息操作函数
export const chatOperations = {
  // 添加消息
  async add(noteId: number, role: 'user' | 'assistant', content: string): Promise<number> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    const result = await db.execute(
      `INSERT INTO chat_messages (note_id, role, content, timestamp) VALUES (?, ?, ?, ?)`,
      [noteId, role, content, now]
    )
    
    return result.lastInsertId ?? 0
  },

  // 获取笔记的所有消息
  async getByNoteId(noteId: number): Promise<ChatMessage[]> {
    const db = await getDatabase()
    
    const rows = await db.select<ChatMessageRow[]>(
      `SELECT * FROM chat_messages WHERE note_id = ? ORDER BY timestamp ASC`,
      [noteId]
    )
    
    return rows.map(rowToChatMessage)
  },

  // 更新消息内容
  async update(id: number, content: string): Promise<void> {
    const db = await getDatabase()
    
    await db.execute(
      `UPDATE chat_messages SET content = ? WHERE id = ?`,
      [content, id]
    )
  },

  // 删除单条消息
  async delete(id: number): Promise<void> {
    const db = await getDatabase()
    
    await db.execute('DELETE FROM chat_messages WHERE id = ?', [id])
  },

  // 删除某条消息之后的所有消息
  async deleteAfter(noteId: number, timestamp: Date): Promise<void> {
    const db = await getDatabase()
    
    await db.execute(
      `DELETE FROM chat_messages WHERE note_id = ? AND timestamp > ?`,
      [noteId, timestamp.toISOString()]
    )
  },

  // 清空笔记的所有消息
  async clearByNoteId(noteId: number): Promise<void> {
    const db = await getDatabase()
    
    await db.execute('DELETE FROM chat_messages WHERE note_id = ?', [noteId])
  },
}

// ============= 数据库管理功能 =============

export const dbOperations = {
  // 获取数据库路径
  async getPath(): Promise<string> {
    return await invoke<string>('get_database_path')
  },

  // 获取数据库信息
  async getInfo(): Promise<{
    path: string
    exists: boolean
    size: number
    size_formatted: string
    is_custom: boolean
  }> {
    return await invoke('get_database_info')
  },

  // 复制数据库到新位置
  async copyTo(newPath: string): Promise<void> {
    await invoke('copy_database_to', { newPath })
  },

  // 更改数据库存储位置
  async changeLocation(newDir: string): Promise<string> {
    return await invoke<string>('change_database_location', { newDir })
  },

  // 导出数据为 JSON
  async exportJSON(): Promise<string> {
    const db = await getDatabase()
    
    const notes = await db.select<NoteRow[]>('SELECT * FROM notes')
    const messages = await db.select<ChatMessageRow[]>('SELECT * FROM chat_messages')
    
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      notes: notes.map(rowToNote),
      chat_messages: messages.map(rowToChatMessage),
    }
    
    return JSON.stringify(exportData, null, 2)
  },

  // 从 JSON 导入数据
  async importJSON(jsonData: string): Promise<{ notes: number; messages: number }> {
    const db = await getDatabase()
    const data = JSON.parse(jsonData)
    
    let notesImported = 0
    let messagesImported = 0
    
    // 导入笔记
    if (data.notes && Array.isArray(data.notes)) {
      for (const note of data.notes) {
        await db.execute(
          `INSERT INTO notes (title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_date, reminder_enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            note.title,
            note.content,
            JSON.stringify(note.tags || []),
            note.isFavorite || 0,
            note.isDeleted || 0,
            note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
            note.updatedAt instanceof Date ? note.updatedAt.toISOString() : note.updatedAt,
            note.reminderDate ? (note.reminderDate instanceof Date ? note.reminderDate.toISOString() : note.reminderDate) : null,
            note.reminderEnabled || 0
          ]
        )
        notesImported++
      }
    }
    
    // 导入聊天消息
    if (data.chat_messages && Array.isArray(data.chat_messages)) {
      for (const msg of data.chat_messages) {
        await db.execute(
          `INSERT INTO chat_messages (note_id, role, content, timestamp) VALUES (?, ?, ?, ?)`,
          [
            msg.noteId,
            msg.role,
            msg.content,
            msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
          ]
        )
        messagesImported++
      }
    }
    
    return { notes: notesImported, messages: messagesImported }
  },
}
