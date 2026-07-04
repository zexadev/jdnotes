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
  uuid?: string // 跨设备稳定身份（同步保留）；笔记引用 note://<uuid> 用它
  title: string
  content: string
  tags: string[] // 标签数组
  isFavorite: number // 0 或 1
  isDeleted: number // 0 或 1
  isPrivate: number // 0 或 1，1 = 不参与同步（不会发给任何对端）
  createdAt: Date
  updatedAt: Date
  // 日历提醒相关字段
  reminderDate?: Date // 提醒日期时间
  reminderEnabled?: number // 0 或 1，是否启用提醒
}

// SQLite 返回的原始行数据类型
interface NoteRow {
  id: number
  uuid: string | null
  title: string
  content: string
  tags: string // JSON 字符串
  is_favorite: number
  is_deleted: number
  is_private: number
  created_at: string
  updated_at: string
  reminder_date: string | null
  reminder_enabled: number
}

// 聊天消息数据类型
export interface ChatMessage {
  id: number
  noteId: number
  conversationId: number | null
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result'
  content: string
  images: string[] // base64 图片数组
  timestamp: Date
}

// SQLite 返回的聊天消息原始数据
interface ChatMessageRow {
  id: number
  note_id: number
  conversation_id: number | null
  role: string
  content: string
  images: string | null
  timestamp: string
}

// 对话数据类型
export interface Conversation {
  id: number
  noteId: number
  title: string
  createdAt: Date
  updatedAt: Date
}

// SQLite 返回的对话原始数据
interface ConversationRow {
  id: number
  note_id: number
  title: string
  created_at: string
  updated_at: string
}

/**
 * 将 SQLite 行数据转换为 Note 对象
 */
function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    uuid: row.uuid ?? undefined,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags || '[]'),
    isFavorite: row.is_favorite,
    isDeleted: row.is_deleted,
    isPrivate: row.is_private ?? 0,
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
    conversationId: row.conversation_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    images: JSON.parse(row.images || '[]'),
    timestamp: new Date(row.timestamp),
  }
}

/**
 * 将 SQLite 行数据转换为 Conversation 对象
 */
function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    noteId: row.note_id,
    title: row.title,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
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
  // 开启 WAL 模式 + busy_timeout，保证前端与后端同步引擎并发写同一 db 文件时安全
  try {
    await database.execute('PRAGMA journal_mode=WAL;')
    await database.execute('PRAGMA busy_timeout=5000;')
  } catch (e) {
    console.warn('设置 WAL 失败:', e)
  }
  return database
}

/**
 * 初始化数据库连接
 */
export async function initDatabase(): Promise<void> {
  await getDatabase()
  await backfillUuids()
  await migrateImagesToAttachments()
}

// 为没有 uuid 的历史笔记回填全局唯一 uuid（幂等，作为多设备同步身份）
async function backfillUuids(): Promise<void> {
  try {
    const db = await getDatabase()
    const rows = await db.select<{ id: number }[]>(
      "SELECT id FROM notes WHERE uuid IS NULL OR uuid = ''"
    )
    for (const row of rows) {
      await db.execute('UPDATE notes SET uuid = ? WHERE id = ?', [crypto.randomUUID(), row.id])
    }
    if (rows.length > 0) {
      console.log(`已为 ${rows.length} 条笔记回填 uuid`)
    }
  } catch (e) {
    console.warn('回填 uuid 失败:', e)
  }
}

// 把 content 里的 base64 内嵌图片抽成附件文件，返回替换为 attachment://<hash> 引用的 content。
// 无内嵌图时原样快速返回（保存路径几乎零开销）。
async function externalizeImages(content: string): Promise<string> {
  if (!content.includes('data:image')) return content
  const re = /!\[([^\]]*)\]\(data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+?)(\?w=\d+)?\)/g
  let result = content
  for (const m of [...content.matchAll(re)]) {
    const [full, alt, mimeExt, base64, widthPart] = m
    try {
      const ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt === 'svg+xml' ? 'svg' : mimeExt
      const hash = await invoke<string>('save_attachment_base64', {
        base64Data: base64.replace(/\s/g, ''),
        ext,
      })
      result = result.replace(full, `![${alt}](attachment://${hash}${widthPart || ''})`)
    } catch (e) {
      console.warn('图片附件化失败:', e)
    }
  }
  return result
}

// 存量迁移：把所有笔记的 base64 内嵌图迁成附件（content 与 synced_content 各自迁移以避免同步假冲突）。
// 幂等（迁完不再含 data:image），迁移前自动备份数据库。
async function migrateImagesToAttachments(): Promise<void> {
  try {
    const db = await getDatabase()
    const rows = await db.select<{ id: number; content: string; synced_content: string | null }[]>(
      "SELECT id, content, synced_content FROM notes WHERE content LIKE '%data:image%' OR synced_content LIKE '%data:image%'"
    )
    if (rows.length === 0) return
    // 不可逆操作前先备份数据库
    try {
      const path = await invoke<string>('get_database_path')
      await invoke('copy_database_to', { newPath: `${path}.pre-attachment-backup` })
    } catch (e) {
      console.warn('迁移前备份失败（仍继续）:', e)
    }
    for (const row of rows) {
      const newContent = await externalizeImages(row.content)
      const newSynced = row.synced_content ? await externalizeImages(row.synced_content) : null
      await db.execute('UPDATE notes SET content = ?, synced_content = ? WHERE id = ?', [
        newContent,
        newSynced,
        row.id,
      ])
    }
    console.log(`已将 ${rows.length} 条笔记的内嵌图片迁移为附件`)
  } catch (e) {
    console.warn('图片附件迁移失败:', e)
  }
}

// 把 content 里的 attachment://<hash> 引用还原成 base64 内嵌（导出自包含 JSON 用）
async function internalizeImages(content: string): Promise<string> {
  if (!content.includes('attachment://')) return content
  const re = /!\[([^\]]*)\]\(attachment:\/\/([a-f0-9]+)(\?w=\d+)?\)/g
  let result = content
  for (const m of [...content.matchAll(re)]) {
    const [full, alt, hash, widthPart] = m
    try {
      const dataUrl = await invoke<string | null>('read_attachment_data_url', { hash })
      if (dataUrl) result = result.replace(full, `![${alt}](${dataUrl}${widthPart || ''})`)
    } catch (e) {
      console.warn('附件还原失败:', e)
    }
  }
  return result
}

// 防止重复初始化的标志
let isInitializing = false

/**
 * 初始化默认数据（仅在数据库为空时）
 */
// 默认笔记用固定 uuid：保证不同设备的内置笔记被视为「同一条」，同步时不会各留一份
const WELCOME_NOTE_UUID = '00000000-0000-4000-8000-000000000001'
const SHORTCUTS_NOTE_UUID = '00000000-0000-4000-8000-000000000002'

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
      `INSERT INTO notes (uuid, title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_enabled)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, 0)`,
      [
        WELCOME_NOTE_UUID,
        '欢迎使用 Lapis',
        `欢迎使用 Lapis！这是一个简洁高效的本地笔记应用。

## 功能特性

- **富文本编辑**：支持 Markdown 语法
- **代码块**：语法高亮，支持运行 Shell 命令
- **自动保存**：本地持久化存储
- **AI 智能助手**：气泡菜单 AI 功能 + 侧栏对话
- **多来源 AI**：支持 OpenAI、Claude、Gemini、Ollama，快速切换
- **斜杠命令**：快速调用 AI 模板
- **笔记引用**：输入 \`[[\` 引用其它笔记，单击跳转、自动反向链接
- **日历视图**：按时间维度管理笔记
- **笔记提醒**：设置提醒，到期通知
- **SQLite 存储**：数据可备份迁移

## 快速开始

1. 点击左上角 **+ 新建笔记** 创建笔记
2. 按 \`Ctrl+K\` 搜索已有笔记
3. 按 \`Ctrl+L\` 打开 AI 助手
4. 点击侧栏 **📅 日历** 查看时间轴
5. 在正文输入 \`[[\` 可引用其它笔记 —— 试试点这条引用跳转：[快捷键指南](note://${SHORTCUTS_NOTE_UUID})

开始创建你的第一个笔记吧！`,
        '["入门"]',
        now,
        now
      ]
    )

    // 插入快捷键指南
    await db.execute(
      `INSERT INTO notes (uuid, title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_enabled)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, 0)`,
      [
        SHORTCUTS_NOTE_UUID,
        '快捷键指南',
        `## 编辑器快捷键

- \`Ctrl+B\` - 粗体
- \`Ctrl+I\` - 斜体
- \`Ctrl+Shift+C\` - 代码块

## 通用快捷键

- \`Ctrl+K\` - 搜索笔记
- \`Ctrl+L\` - 打开/关闭 AI 助手侧栏
- \`Ctrl+J\` - 内联提问（选中文本后）

## AI 功能

**气泡菜单**：选中文本后自动弹出，包含 AI 改进、翻译、总结等功能

**内联提问**：选中文本后按 \`Ctrl+J\`，直接向 AI 提问

**斜杠命令**：输入 \`/\` 触发快捷模板
- AI 续写 - 根据上文继续写作
- 会议纪要 - 生成结构化会议模板
- 脑暴大纲 - 生成 5 点思维大纲
- 代码实现 - 根据描述生成代码

**AI 侧栏**：按 \`Ctrl+L\` 打开，可与 AI 自由对话，支持多来源快速切换

## 日历视图

点击侧栏 **📅 日历** 进入日历视图：
- **月视图**：查看整月笔记分布，支持热力图显示
- **周视图**：查看一周笔记详情
- **日视图**：查看单日笔记，支持设置提醒

## 提醒功能

在笔记编辑界面，点击工具栏的 **🔔 铃铛按钮** 设置提醒：
- 快捷选项：30分钟后、1小时后、3小时后、明天此时
- 自定义时间：选择任意时间
- 到期通知：系统弹窗通知 + 应用内通知

## 笔记引用

在正文输入 \`[[\` 会弹出笔记选择框，选中即插入引用：
- **单击引用**直接跳转到目标笔记
- 被引用的笔记底部会出现「被以下笔记引用」反向链接
- 引用基于稳定 ID，跨设备同步后依然有效`,
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
      `INSERT INTO notes (uuid, title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_enabled)
       VALUES (?, ?, ?, '[]', 0, 0, ?, ?, 0)`,
      [crypto.randomUUID(), title, content, now, now]
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
      params.push(await externalizeImages(data.content))
    }
    
    params.push(id)
    
    await db.execute(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`,
      params
    )
  },

  // 切换收藏状态。bump updated_at：收藏是要同步的字段，靠 updated_at 走 LWW，
  // 否则切换收藏不更新时间戳 → merge 的"内容相同"分支会静默丢掉收藏变更。
  async toggleFavorite(id: number): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    await db.execute(
      `UPDATE notes SET is_favorite = 1 - is_favorite, updated_at = ? WHERE id = ?`,
      [now, id]
    )
  },

  // 切换私有状态：1 = 不参与同步（同步层 read_local_notes 会过滤掉）
  // 不更新 updatedAt：仅本机偏好，没改内容
  async togglePrivate(id: number): Promise<void> {
    const db = await getDatabase()
    await db.execute(
      `UPDATE notes SET is_private = 1 - is_private WHERE id = ?`,
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

    // 记墓碑：保留 uuid，防止同步时被仍持有该笔记的对端重新插入"复活"
    const rows = await db.select<{ uuid: string | null }[]>('SELECT uuid FROM notes WHERE id = ?', [id])
    const uuid = rows[0]?.uuid
    if (uuid) {
      await db.execute('INSERT OR IGNORE INTO deleted_notes (uuid, deleted_at) VALUES (?, ?)', [uuid, new Date().toISOString()])
    }
    // 先删除相关的聊天消息
    await db.execute('DELETE FROM chat_messages WHERE note_id = ?', [id])
    // 再删除笔记
    await db.execute('DELETE FROM notes WHERE id = ?', [id])
  },

  // 批量软删除（移到废纸篓）：刷新 updated_at → 作为墓碑同步删除到其它设备
  async softDeleteMany(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    const db = await getDatabase()
    const now = new Date().toISOString()
    const placeholders = ids.map(() => '?').join(',')
    await db.execute(
      `UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...ids]
    )
  },

  // 批量恢复
  async restoreMany(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    const db = await getDatabase()
    const now = new Date().toISOString()
    const placeholders = ids.map(() => '?').join(',')
    await db.execute(
      `UPDATE notes SET is_deleted = 0, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...ids]
    )
  },

  // 批量彻底删除（不可逆，连带聊天消息）
  async permanentDeleteMany(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    const db = await getDatabase()
    const placeholders = ids.map(() => '?').join(',')
    // 记墓碑：防止同步时被对端重新插入复活
    const rows = await db.select<{ uuid: string | null }[]>(`SELECT uuid FROM notes WHERE id IN (${placeholders})`, [...ids])
    const now = new Date().toISOString()
    for (const r of rows) {
      if (r.uuid) await db.execute('INSERT OR IGNORE INTO deleted_notes (uuid, deleted_at) VALUES (?, ?)', [r.uuid, now])
    }
    await db.execute(`DELETE FROM chat_messages WHERE note_id IN (${placeholders})`, [...ids])
    await db.execute(`DELETE FROM notes WHERE id IN (${placeholders})`, [...ids])
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

  // 按 uuid 获取笔记（笔记引用 note://<uuid> 点击跳转时解析）
  async getByUuid(uuid: string): Promise<Note | undefined> {
    const db = await getDatabase()
    const rows = await db.select<NoteRow[]>('SELECT * FROM notes WHERE uuid = ?', [uuid])
    return rows.length > 0 ? rowToNote(rows[0]) : undefined
  },

  // 反向链接：哪些未删除的笔记在正文里引用了当前笔记。
  // 两种引用形式都算：note://<uuid>（UI 手选，稳）+ 字面 [[标题]]（AI/手打，Obsidian 风）。
  // SQLite LIKE 里 [ 不是通配符，'%[[' || ? || ']]%' 即字面 [[标题]]；全表扫原生执行、只回传命中行。
  async findBacklinks(uuid: string, title?: string): Promise<{ id: number; title: string }[]> {
    const db = await getDatabase()
    const clauses: string[] = []
    const params: string[] = []
    if (uuid) {
      clauses.push("content LIKE '%note://' || ? || '%'")
      params.push(uuid)
    }
    const t = (title || '').trim()
    if (t) {
      clauses.push("content LIKE '%[[' || ? || ']]%'")
      params.push(t)
    }
    if (clauses.length === 0) return []
    let sql = `SELECT id, title FROM notes WHERE is_deleted = 0 AND (${clauses.join(' OR ')})`
    if (uuid) {
      // 排除笔记自身（自己引用自己标题的边界情况）
      sql += ' AND (uuid IS NULL OR uuid != ?)'
      params.push(uuid)
    }
    sql += ' ORDER BY updated_at DESC'
    return await db.select<{ id: number; title: string }[]>(sql, params)
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

// 对话操作函数
export const conversationOperations = {
  // 创建新对话
  async create(noteId: number, title: string = '新对话'): Promise<number> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    const result = await db.execute(
      `INSERT INTO conversations (note_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [noteId, title, now, now]
    )

    return result.lastInsertId ?? 0
  },

  // 获取笔记的所有对话
  async getByNoteId(noteId: number): Promise<Conversation[]> {
    const db = await getDatabase()

    const rows = await db.select<ConversationRow[]>(
      `SELECT * FROM conversations WHERE note_id = ? ORDER BY updated_at DESC`,
      [noteId]
    )

    return rows.map(rowToConversation)
  },

  // 重命名对话
  async rename(id: number, title: string): Promise<void> {
    const db = await getDatabase()

    await db.execute(
      `UPDATE conversations SET title = ? WHERE id = ?`,
      [title, id]
    )
  },

  // 删除对话及其消息
  async delete(id: number): Promise<void> {
    const db = await getDatabase()

    await db.execute('DELETE FROM chat_messages WHERE conversation_id = ?', [id])
    await db.execute('DELETE FROM conversations WHERE id = ?', [id])
  },

  // 更新对话的 updated_at
  async touch(id: number): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    await db.execute(
      `UPDATE conversations SET updated_at = ? WHERE id = ?`,
      [now, id]
    )
  },
}

// 聊天消息操作函数
export const chatOperations = {
  // 添加消息
  async add(
    noteId: number,
    role: ChatMessage['role'],
    content: string,
    conversationId?: number,
    images?: string[]
  ): Promise<number> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const imagesJson = JSON.stringify(images || [])

    const result = await db.execute(
      `INSERT INTO chat_messages (note_id, conversation_id, role, content, images, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [noteId, conversationId ?? null, role, content, imagesJson, now]
    )

    // 更新对话的 updated_at
    if (conversationId) {
      await conversationOperations.touch(conversationId)
    }

    return result.lastInsertId ?? 0
  },

  // 获取对话的所有消息
  async getByConversationId(conversationId: number): Promise<ChatMessage[]> {
    const db = await getDatabase()

    const rows = await db.select<ChatMessageRow[]>(
      `SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY timestamp ASC`,
      [conversationId]
    )

    return rows.map(rowToChatMessage)
  },

  // 获取笔记的所有消息（兼容旧接口）
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
  async deleteAfter(noteId: number, timestamp: Date, conversationId?: number): Promise<void> {
    const db = await getDatabase()

    if (conversationId) {
      await db.execute(
        `DELETE FROM chat_messages WHERE conversation_id = ? AND timestamp > ?`,
        [conversationId, timestamp.toISOString()]
      )
    } else {
      await db.execute(
        `DELETE FROM chat_messages WHERE note_id = ? AND timestamp > ?`,
        [noteId, timestamp.toISOString()]
      )
    }
  },

  // 清空对话的所有消息
  async clearByConversationId(conversationId: number): Promise<void> {
    const db = await getDatabase()

    await db.execute('DELETE FROM chat_messages WHERE conversation_id = ?', [conversationId])
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

    // 导出自包含：把 attachment:// 引用还原成 base64 内嵌，保证一个 JSON 文件带走全部图片
    const exportedNotes = []
    for (const row of notes) {
      const note = rowToNote(row)
      note.content = await internalizeImages(note.content)
      exportedNotes.push(note)
    }

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      notes: exportedNotes,
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
    // 旧 note id → 新自增 id 映射:导入笔记拿到新 id，聊天消息必须按此重链，
    // 否则消息会挂到错误笔记或悬空(导出体里的 noteId 是源库旧自增 id)
    const noteIdMap = new Map<number, number>()

    // 导入笔记
    if (data.notes && Array.isArray(data.notes)) {
      for (const note of data.notes) {
        // 保留原 uuid：让正文里的 note://<uuid> 笔记引用在导入后仍能解析。
        // 与已有笔记 uuid 冲突（同库重复导入）时退回新 uuid，避免唯一索引报错中断整个导入。
        const importUuid = typeof note.uuid === 'string' && note.uuid ? note.uuid : crypto.randomUUID()
        const insertSql = `INSERT INTO notes (uuid, title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_date, reminder_enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        const insertParams = [
          note.title,
          await externalizeImages(note.content),
          JSON.stringify(note.tags || []),
          note.isFavorite || 0,
          note.isDeleted || 0,
          note.createdAt instanceof Date ? note.createdAt.toISOString() : note.createdAt,
          note.updatedAt instanceof Date ? note.updatedAt.toISOString() : note.updatedAt,
          note.reminderDate ? (note.reminderDate instanceof Date ? note.reminderDate.toISOString() : note.reminderDate) : null,
          note.reminderEnabled || 0,
        ]
        let res
        try {
          res = await db.execute(insertSql, [importUuid, ...insertParams])
        } catch {
          res = await db.execute(insertSql, [crypto.randomUUID(), ...insertParams])
        }
        if (note.id != null && res?.lastInsertId != null) {
          noteIdMap.set(Number(note.id), Number(res.lastInsertId))
        }
        notesImported++
      }
    }
    
    // 导入聊天消息：按 noteIdMap 把旧 noteId 重链到新笔记 id；映射缺失则跳过(不写悬空消息)
    if (data.chat_messages && Array.isArray(data.chat_messages)) {
      for (const msg of data.chat_messages) {
        const newNoteId = noteIdMap.get(Number(msg.noteId))
        if (newNoteId == null) continue
        await db.execute(
          `INSERT INTO chat_messages (note_id, role, content, timestamp) VALUES (?, ?, ?, ?)`,
          [
            newNoteId,
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
