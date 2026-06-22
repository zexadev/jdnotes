use std::path::PathBuf;
use std::sync::Arc;

use rmcp::{
    ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{CallToolResult, Content, ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router,
};
use rmcp::ErrorData as McpError;
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::StreamableHttpService;
use serde::Deserialize;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{Row, SqlitePool};
use tauri::Emitter;

/// MCP Server 实例
#[derive(Clone)]
pub struct JdNotesMcpServer {
    pool: Arc<SqlitePool>,
    app_handle: Option<tauri::AppHandle>,
    #[allow(dead_code)]
    tool_router: ToolRouter<Self>,
}

impl JdNotesMcpServer {
    pub fn new(pool: SqlitePool, app_handle: Option<tauri::AppHandle>) -> Self {
        Self {
            pool: Arc::new(pool),
            app_handle,
            tool_router: Self::tool_router(),
        }
    }

    /// 通知前端数据库已变化
    fn notify_db_changed(&self) {
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit("db:changed", ());
        }
    }

    /// 按 ID 或标题模糊匹配查找笔记，返回 (id, title) 或错误信息
    async fn find_note_by_id_or_title(
        &self,
        id: Option<i64>,
        title: Option<&str>,
    ) -> Result<(i64, String), String> {
        if let Some(note_id) = id {
            let row = sqlx::query(
                "SELECT id, title FROM notes WHERE id = ?1 AND is_deleted = 0"
            )
            .bind(note_id)
            .fetch_optional(self.pool.as_ref())
            .await
            .map_err(|e| format!("查询笔记失败: {}", e))?;

            match row {
                Some(r) => Ok((r.get("id"), r.get("title"))),
                None => Err(format!("未找到 ID 为 {} 的笔记", note_id)),
            }
        } else if let Some(t) = title {
            let search_pattern = format!("%{}%", t);
            let row = sqlx::query(
                "SELECT id, title FROM notes WHERE title LIKE ?1 AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1"
            )
            .bind(&search_pattern)
            .fetch_optional(self.pool.as_ref())
            .await
            .map_err(|e| format!("查询笔记失败: {}", e))?;

            match row {
                Some(r) => Ok((r.get("id"), r.get("title"))),
                None => Err(format!("未找到标题匹配「{}」的笔记", t)),
            }
        } else {
            Err("必须提供 id 或 title 参数".to_string())
        }
    }
}

/// create_note 工具参数
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CreateNoteParams {
    #[schemars(description = "笔记标题")]
    title: String,
    #[schemars(description = "笔记内容，支持 Markdown 格式")]
    content: String,
    #[schemars(description = "可选的标签列表")]
    tags: Option<Vec<String>>,
}

/// append_note 工具参数
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct AppendNoteParams {
    #[schemars(description = "笔记 ID（与 title 二选一，优先使用 ID）")]
    id: Option<i64>,
    #[schemars(description = "要查找的笔记标题（模糊匹配，与 id 二选一）")]
    title: Option<String>,
    #[schemars(description = "要追加的内容，支持 Markdown 格式")]
    content: String,
}

/// get_note 工具参数
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetNoteParams {
    #[schemars(description = "笔记 ID（与 title 二选一，优先使用 ID）")]
    id: Option<i64>,
    #[schemars(description = "要查找的笔记标题（模糊匹配，与 id 二选一）")]
    title: Option<String>,
    #[schemars(description = "最大返回内容字符数，不传则返回全部")]
    max_length: Option<i64>,
    #[schemars(description = "内容起始偏移字符数，默认 0")]
    offset: Option<i64>,
}

/// search_notes 工具参数
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SearchNotesParams {
    #[schemars(description = "搜索关键词，会匹配标题和内容")]
    query: String,
    #[schemars(description = "按标签过滤（可选）")]
    tag: Option<String>,
}

/// list_notes 工具参数
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ListNotesParams {
    #[schemars(description = "返回数量限制，默认 50")]
    limit: Option<i64>,
}

/// update_note 工具参数
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpdateNoteParams {
    /// 笔记 ID（与 title 二选一，优先使用 ID）
    #[schemars(description = "笔记 ID（与 title 二选一，优先使用 ID）")]
    id: Option<i64>,
    /// 要查找的笔记标题（模糊匹配，与 id 二选一）
    #[schemars(description = "要查找的笔记标题（模糊匹配，与 id 二选一）")]
    title: Option<String>,
    /// 新标题（可选，不传则不修改）
    #[schemars(description = "新标题，不传则保持原标题")]
    new_title: Option<String>,
    /// 新内容（可选，不传则不修改）
    #[schemars(description = "新内容，将完全替换原内容，支持 Markdown 格式")]
    new_content: Option<String>,
    /// 新标签（可选，不传则不修改）
    #[schemars(description = "新标签列表，将完全替换原标签")]
    new_tags: Option<Vec<String>>,
}

#[tool_router]
impl JdNotesMcpServer {
    #[tool(description = "Create a new note in Lapis / 在 Lapis 中创建新笔记")]
    async fn create_note(
        &self,
        Parameters(params): Parameters<CreateNoteParams>,
    ) -> Result<CallToolResult, McpError> {
        let now = chrono::Local::now()
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();
        let tags_json = serde_json::to_string(&params.tags.unwrap_or_default())
            .unwrap_or_else(|_| "[]".to_string());

        let result = sqlx::query(
            "INSERT INTO notes (title, content, tags, is_favorite, is_deleted, created_at, updated_at, reminder_enabled) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, 0)"
        )
        .bind(&params.title)
        .bind(&params.content)
        .bind(&tags_json)
        .bind(&now)
        .bind(&now)
        .execute(self.pool.as_ref())
        .await;

        match result {
            Ok(r) => {
                self.notify_db_changed();
                Ok(CallToolResult::success(vec![Content::text(format!(
                    "笔记创建成功，ID: {}",
                    r.last_insert_rowid()
                ))]))
            }
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "创建笔记失败: {}",
                e
            ))])),
        }
    }

    #[tool(description = "Find a note by ID or title (fuzzy match) and append content / 按 ID 或标题模糊匹配笔记并追加内容")]
    async fn append_note(
        &self,
        Parameters(params): Parameters<AppendNoteParams>,
    ) -> Result<CallToolResult, McpError> {
        let (note_id, title) = match self
            .find_note_by_id_or_title(params.id, params.title.as_deref())
            .await
        {
            Ok(v) => v,
            Err(e) => return Ok(CallToolResult::error(vec![Content::text(e)])),
        };

        let existing = sqlx::query("SELECT content FROM notes WHERE id = ?1")
            .bind(note_id)
            .fetch_one(self.pool.as_ref())
            .await;

        match existing {
            Ok(row) => {
                let existing_content: String = row.get("content");
                let now = chrono::Local::now()
                    .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                    .to_string();
                let new_content = format!("{}\n\n{}", existing_content, params.content);

                match sqlx::query("UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3")
                    .bind(&new_content)
                    .bind(&now)
                    .bind(note_id)
                    .execute(self.pool.as_ref())
                    .await
                {
                    Ok(_) => {
                        self.notify_db_changed();
                        Ok(CallToolResult::success(vec![Content::text(format!(
                            "内容已追加到笔记「{}」(ID: {})",
                            title, note_id
                        ))]))
                    }
                    Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                        "更新笔记失败: {}",
                        e
                    ))])),
                }
            }
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "查询笔记内容失败: {}",
                e
            ))])),
        }
    }

    #[tool(description = "Find a note by ID or title (fuzzy match) and update its title, content or tags / 按 ID 或标题模糊匹配笔记并修改内容")]
    async fn update_note(
        &self,
        Parameters(params): Parameters<UpdateNoteParams>,
    ) -> Result<CallToolResult, McpError> {
        let (note_id, old_title) = match self
            .find_note_by_id_or_title(params.id, params.title.as_deref())
            .await
        {
            Ok(v) => v,
            Err(e) => return Ok(CallToolResult::error(vec![Content::text(e)])),
        };

        let now = chrono::Local::now()
            .format("%Y-%m-%dT%H:%M:%S%.3fZ")
            .to_string();

        let mut updates = vec!["updated_at = ?1".to_string()];
        let mut param_index = 2;
        let mut bind_values: Vec<String> = vec![now];

        if let Some(ref new_title) = params.new_title {
            updates.push(format!("title = ?{}", param_index));
            bind_values.push(new_title.clone());
            param_index += 1;
        }
        if let Some(ref new_content) = params.new_content {
            updates.push(format!("content = ?{}", param_index));
            bind_values.push(new_content.clone());
            param_index += 1;
        }
        if let Some(ref new_tags) = params.new_tags {
            updates.push(format!("tags = ?{}", param_index));
            bind_values.push(
                serde_json::to_string(new_tags).unwrap_or_else(|_| "[]".to_string()),
            );
            param_index += 1;
        }

        if param_index == 2 {
            return Ok(CallToolResult::error(vec![Content::text(
                "未指定任何要修改的字段（new_title / new_content / new_tags）",
            )]));
        }

        let sql = format!(
            "UPDATE notes SET {} WHERE id = ?{}",
            updates.join(", "),
            param_index
        );

        let mut query = sqlx::query(&sql);
        for val in &bind_values {
            query = query.bind(val);
        }
        query = query.bind(note_id);

        match query.execute(self.pool.as_ref()).await {
            Ok(_) => {
                self.notify_db_changed();
                Ok(CallToolResult::success(vec![Content::text(format!(
                    "笔记「{}」(ID: {}) 已更新",
                    old_title, note_id
                ))]))
            }
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "更新笔记失败: {}",
                e
            ))])),
        }
    }

    #[tool(description = "Find a note by ID or title (fuzzy match) and return its content / 按 ID 或标题模糊匹配笔记并返回内容")]
    async fn get_note(
        &self,
        Parameters(params): Parameters<GetNoteParams>,
    ) -> Result<CallToolResult, McpError> {
        let (note_id, _title) = match self
            .find_note_by_id_or_title(params.id, params.title.as_deref())
            .await
        {
            Ok(v) => v,
            Err(e) => return Ok(CallToolResult::error(vec![Content::text(e)])),
        };

        let offset = params.offset.unwrap_or(0).max(0);

        // 根据是否有 max_length 选择不同查询
        let row = if let Some(max_len) = params.max_length {
            sqlx::query(
                "SELECT id, title, SUBSTR(content, ?1, ?2) as content, tags, created_at, updated_at, LENGTH(content) as total_length FROM notes WHERE id = ?3 AND is_deleted = 0"
            )
            .bind(offset + 1) // SQL SUBSTR 从 1 开始
            .bind(max_len)
            .bind(note_id)
            .fetch_optional(self.pool.as_ref())
            .await
        } else {
            sqlx::query(
                "SELECT id, title, content, tags, created_at, updated_at, LENGTH(content) as total_length FROM notes WHERE id = ?1 AND is_deleted = 0"
            )
            .bind(note_id)
            .fetch_optional(self.pool.as_ref())
            .await
        };

        match row {
            Ok(Some(row)) => {
                let id: i64 = row.get("id");
                let title: String = row.get("title");
                let content: String = row.get("content");
                let tags: String = row.get("tags");
                let created_at: String = row.get("created_at");
                let updated_at: String = row.get("updated_at");
                let total_length: i64 = row.get("total_length");

                let length_info = if params.max_length.is_some() && (content.len() as i64) < total_length - offset {
                    format!(" | 内容长度: {} 字符（已截断，共 {} 字符）", content.len(), total_length)
                } else {
                    format!(" | 内容长度: {} 字符", total_length)
                };

                Ok(CallToolResult::success(vec![Content::text(format!(
                    "# {}\n\nID: {} | 标签: {} | 创建: {} | 更新: {}{}\n\n---\n\n{}",
                    title, id, tags, created_at, updated_at, length_info, content
                ))]))
            }
            Ok(None) => Ok(CallToolResult::error(vec![Content::text("笔记不存在")])),
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "查询笔记失败: {}",
                e
            ))])),
        }
    }

    #[tool(description = "Search notes by keyword in title and content, optionally filter by tag / 按关键词搜索笔记标题和内容，可按标签过滤")]
    async fn search_notes(
        &self,
        Parameters(params): Parameters<SearchNotesParams>,
    ) -> Result<CallToolResult, McpError> {
        let search_pattern = format!("%{}%", params.query);

        let (sql, has_tag) = if let Some(ref tag) = params.tag {
            let tag_pattern = format!("%\"{}\"%" , tag);
            // 需要两个 bind：?1 是搜索关键词，?2 是标签
            (format!(
                "SELECT id, title, SUBSTR(content, 1, 100) as preview FROM notes WHERE (title LIKE ?1 OR content LIKE ?1) AND tags LIKE ?2 AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 20"
            ), Some(tag_pattern))
        } else {
            ("SELECT id, title, SUBSTR(content, 1, 100) as preview FROM notes WHERE (title LIKE ?1 OR content LIKE ?1) AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 20".to_string(), None)
        };

        let mut query = sqlx::query(&sql).bind(&search_pattern);
        if let Some(ref tag_pattern) = has_tag {
            query = query.bind(tag_pattern);
        }

        let notes = query.fetch_all(self.pool.as_ref()).await;

        match notes {
            Ok(rows) => {
                if rows.is_empty() {
                    return Ok(CallToolResult::success(vec![Content::text(format!(
                        "未找到匹配「{}」的笔记",
                        params.query
                    ))]));
                }

                let mut result = format!("搜索「{}」找到 {} 篇笔记：\n\n", params.query, rows.len());
                for row in &rows {
                    let id: i64 = row.get("id");
                    let title: String = row.get("title");
                    let preview: String = row.get("preview");
                    let preview_clean = preview.replace('\n', " ");
                    result.push_str(&format!("- **{}** (ID: {}) — {}...\n", title, id, preview_clean));
                }
                Ok(CallToolResult::success(vec![Content::text(result)]))
            }
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "搜索笔记失败: {}",
                e
            ))])),
        }
    }

    #[tool(description = "List all note titles with tags and content length / 列出所有笔记标题、标签和内容长度")]
    async fn list_notes(
        &self,
        Parameters(params): Parameters<ListNotesParams>,
    ) -> Result<CallToolResult, McpError> {
        let limit = params.limit.unwrap_or(50);

        let notes = sqlx::query(
            "SELECT id, title, tags, LENGTH(content) as content_length, updated_at FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC LIMIT ?1"
        )
        .bind(limit)
        .fetch_all(self.pool.as_ref())
        .await;

        match notes {
            Ok(rows) => {
                if rows.is_empty() {
                    return Ok(CallToolResult::success(vec![Content::text("暂无笔记")]));
                }

                let mut result = format!("共 {} 篇笔记：\n\n", rows.len());
                for row in &rows {
                    let id: i64 = row.get("id");
                    let title: String = row.get("title");
                    let tags: String = row.get("tags");
                    let content_length: i64 = row.get("content_length");
                    let updated_at: String = row.get("updated_at");
                    result.push_str(&format!(
                        "- **{}** (ID: {}) — 标签: {} | {}字 | 更新于 {}\n",
                        title, id, tags, content_length, updated_at
                    ));
                }
                Ok(CallToolResult::success(vec![Content::text(result)]))
            }
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "列出笔记失败: {}",
                e
            ))])),
        }
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for JdNotesMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(
                "Lapis MCP Server - 本地笔记应用的读写接口。\n\n\
                 可用工具：\n\
                 - create_note: 创建新笔记（标题、内容、标签）\n\
                 - append_note: 按 ID 或标题模糊匹配，追加内容到已有笔记\n\
                 - update_note: 按 ID 或标题模糊匹配，修改笔记的标题、内容或标签\n\
                 - get_note: 按 ID 或标题模糊匹配，查看笔记内容（支持分页截断）\n\
                 - search_notes: 按关键词搜索笔记（标题和内容），可按标签过滤\n\
                 - list_notes: 列出所有笔记标题、标签和内容长度\n\n\
                 建议：先用 list_notes 获取笔记 ID，再用 ID 进行读写操作，比标题匹配更精确安全。",
            )
    }
}

/// 注册 MCP Server 到各 AI 编程工具的配置文件
pub fn register_in_ai_tools() {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            log::warn!("无法获取用户主目录，跳过 MCP 自动注册");
            return;
        }
    };

    let url = "http://127.0.0.1:19230/mcp";

    // Claude Code: ~/.claude.json
    register_mcp_entry(
        &home.join(".claude.json"),
        "Claude Code",
        "mcpServers",
        serde_json::json!({ "type": "http", "url": url }),
    );

    // Claude Desktop: %APPDATA%/Claude/claude_desktop_config.json
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let path = std::path::PathBuf::from(appdata);
        register_mcp_entry(
            &path.join("Claude").join("claude_desktop_config.json"),
            "Claude Desktop",
            "mcpServers",
            serde_json::json!({ "url": url }),
        );
    }

    // Cursor: ~/.cursor/mcp.json
    register_mcp_entry(
        &home.join(".cursor").join("mcp.json"),
        "Cursor",
        "mcpServers",
        serde_json::json!({ "url": url }),
    );

    // Windsurf: ~/.codeium/windsurf/mcp_config.json
    register_mcp_entry(
        &home.join(".codeium").join("windsurf").join("mcp_config.json"),
        "Windsurf",
        "mcpServers",
        serde_json::json!({ "serverUrl": url }),
    );

    // Gemini CLI: ~/.gemini/settings.json
    register_mcp_entry(
        &home.join(".gemini").join("settings.json"),
        "Gemini CLI",
        "mcpServers",
        serde_json::json!({ "url": url }),
    );

    // Kiro: ~/.kiro/settings/mcp.json
    register_mcp_entry(
        &home.join(".kiro").join("settings").join("mcp.json"),
        "Kiro",
        "mcpServers",
        serde_json::json!({ "url": url }),
    );

    // Copilot CLI: ~/.copilot/mcp-config.json
    register_mcp_entry(
        &home.join(".copilot").join("mcp-config.json"),
        "Copilot CLI",
        "mcpServers",
        serde_json::json!({ "url": url }),
    );

    // OpenCode: ~/.config/opencode/opencode.json
    register_mcp_entry_nested(
        &home.join(".config").join("opencode").join("opencode.json"),
        "OpenCode",
        "mcp",
        serde_json::json!({ "type": "remote", "url": url }),
    );

    // Cline: %APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let path = std::path::PathBuf::from(appdata)
            .join("Code")
            .join("User")
            .join("globalStorage")
            .join("saoudrizwan.claude-dev")
            .join("settings")
            .join("cline_mcp_settings.json");
        register_mcp_entry(
            &path,
            "Cline",
            "mcpServers",
            serde_json::json!({ "url": url }),
        );
    }

    // === 安装 Agent Skills ===

    // Claude Code: ~/.claude/
    install_skill(&home.join(".claude"), "Claude Code");

    // Copilot CLI / VS Code: ~/.copilot/
    install_skill(&home.join(".copilot"), "Copilot");

    // Gemini CLI: ~/.gemini/
    install_skill(&home.join(".gemini"), "Gemini CLI");
}

/// 通用注册函数：在 JSON 配置文件的指定 key 下添加 lapis 条目
/// 仅当配置文件已存在时才注册（说明用户安装了该工具）
fn register_mcp_entry(
    config_path: &std::path::Path,
    tool_name: &str,
    servers_key: &str,
    server_config: serde_json::Value,
) {
    if !config_path.exists() {
        return;
    }

    let mut config: serde_json::Value = match std::fs::read_to_string(config_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({})),
        Err(_) => return,
    };

    let servers_obj = config
        .as_object_mut()
        .unwrap()
        .entry(servers_key)
        .or_insert_with(|| serde_json::json!({}))
        .as_object_mut()
        .unwrap();

    let mut changed = false;
    // 迁移：清掉旧版遗留的 jdnotes 注册，避免更名后与 lapis 重复
    if servers_obj.remove("jdnotes").is_some() {
        log::info!("已清理 {} 中遗留的旧 jdnotes MCP 注册", tool_name);
        changed = true;
    }
    if servers_obj.contains_key("lapis") {
        log::debug!("Lapis MCP 已注册在 {} 中", tool_name);
    } else {
        servers_obj.insert("lapis".to_string(), server_config);
        log::info!("已自动注册 Lapis MCP 到 {}", tool_name);
        changed = true;
    }

    if !changed {
        return;
    }

    if let Err(e) = std::fs::write(config_path, serde_json::to_string_pretty(&config).unwrap()) {
        log::warn!("写入 {} 配置失败: {}", tool_name, e);
    }
}

/// OpenCode 使用嵌套的 mcp key，格式不同
fn register_mcp_entry_nested(
    config_path: &std::path::Path,
    tool_name: &str,
    servers_key: &str,
    server_config: serde_json::Value,
) {
    if !config_path.exists() {
        return;
    }

    let mut config: serde_json::Value = match std::fs::read_to_string(config_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({})),
        Err(_) => return,
    };

    let servers_obj = config
        .as_object_mut()
        .unwrap()
        .entry(servers_key)
        .or_insert_with(|| serde_json::json!({}))
        .as_object_mut()
        .unwrap();

    let mut changed = false;
    // 迁移：清掉旧版遗留的 jdnotes 注册，避免更名后与 lapis 重复
    if servers_obj.remove("jdnotes").is_some() {
        log::info!("已清理 {} 中遗留的旧 jdnotes MCP 注册", tool_name);
        changed = true;
    }
    if servers_obj.contains_key("lapis") {
        log::debug!("Lapis MCP 已注册在 {} 中", tool_name);
    } else {
        servers_obj.insert("lapis".to_string(), server_config);
        log::info!("已自动注册 Lapis MCP 到 {}", tool_name);
        changed = true;
    }

    if !changed {
        return;
    }

    if let Err(e) = std::fs::write(config_path, serde_json::to_string_pretty(&config).unwrap()) {
        log::warn!("写入 {} 配置失败: {}", tool_name, e);
    }
}

/// Agent Skill 文件内容
const SKILL_CONTENT: &str = r#"---
name: lapis
description: Read and write notes in Lapis app via MCP / 通过 MCP 读写 Lapis 笔记
user-invocable: true
---

# Lapis MCP

Lapis 提供本地 MCP Server，可读取和写入笔记。

## 前提

- Lapis 应用必须正在运行
- MCP Server 地址：http://127.0.0.1:19230/mcp

## 最佳实践

先用 `list_notes` 获取笔记 ID，再用 ID 进行读写操作（比标题匹配更精确安全）。
对于长笔记，使用 `get_note` 的 `max_length` 参数避免一次性加载过多内容。

## 可用工具

### 写入

#### create_note
创建新笔记。
- `title` (string, 必填): 笔记标题
- `content` (string, 必填): 笔记内容，支持 Markdown
- `tags` (string[], 可选): 标签列表

#### append_note
按 ID 或标题模糊匹配已有笔记，追加内容。
- `id` (number, 可选): 笔记 ID（与 title 二选一，优先使用）
- `title` (string, 可选): 要匹配的笔记标题（与 id 二选一）
- `content` (string, 必填): 要追加的内容

#### update_note
按 ID 或标题模糊匹配已有笔记，修改标题、内容或标签。
- `id` (number, 可选): 笔记 ID（与 title 二选一，优先使用）
- `title` (string, 可选): 要匹配的笔记标题（与 id 二选一）
- `new_title` (string, 可选): 新标题
- `new_content` (string, 可选): 新内容（完全替换）
- `new_tags` (string[], 可选): 新标签列表（完全替换）

### 读取

#### get_note
按 ID 或标题模糊匹配，查看笔记内容（支持分页截断）。
- `id` (number, 可选): 笔记 ID（与 title 二选一，优先使用）
- `title` (string, 可选): 要查找的笔记标题（与 id 二选一）
- `max_length` (number, 可选): 最大返回内容字符数，不传则返回全部
- `offset` (number, 可选): 内容起始偏移字符数，默认 0

#### search_notes
按关键词搜索笔记（匹配标题和内容），可按标签过滤。
- `query` (string, 必填): 搜索关键词
- `tag` (string, 可选): 按标签过滤

#### list_notes
列出所有笔记标题、标签和内容长度。
- `limit` (number, 可选): 返回数量限制，默认 50
"#;

/// 安装 Agent Skill 到指定工具的 skills 目录
/// 仅当工具的配置目录已存在时才安装
fn install_skill(tool_dir: &std::path::Path, tool_name: &str) {
    if !tool_dir.exists() {
        return;
    }

    // 迁移：删掉旧版遗留的 jdnotes skill 目录，更名后避免残留
    let old_skill_dir = tool_dir.join("skills").join("jdnotes");
    if old_skill_dir.exists() {
        match std::fs::remove_dir_all(&old_skill_dir) {
            Ok(_) => log::info!("已清理 {} 中遗留的旧 jdnotes skill", tool_name),
            Err(e) => log::warn!("清理 {} 旧 jdnotes skill 目录失败: {}", tool_name, e),
        }
    }

    let skill_dir = tool_dir.join("skills").join("lapis");
    let skill_path = skill_dir.join("SKILL.md");

    if let Err(e) = std::fs::create_dir_all(&skill_dir) {
        log::warn!("创建 {} skill 目录失败: {}", tool_name, e);
        return;
    }

    match std::fs::write(&skill_path, SKILL_CONTENT) {
        Ok(_) => log::info!("已安装 Lapis Skill 到 {}", tool_name),
        Err(e) => log::warn!("写入 {} skill 文件失败: {}", tool_name, e),
    }
}

/// 启动 MCP HTTP Server
pub async fn start_mcp_server(db_path: PathBuf, app_handle: tauri::AppHandle) {
    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());

    let pool = match SqlitePoolOptions::new()
        .max_connections(2)
        .connect(&db_url)
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            log::error!("MCP Server 连接数据库失败: {}", e);
            return;
        }
    };

    let service = StreamableHttpService::new(
        move || Ok(JdNotesMcpServer::new(pool.clone(), Some(app_handle.clone()))),
        LocalSessionManager::default().into(),
        Default::default(),
    );

    let router = axum::Router::new().nest_service("/mcp", service);

    match tokio::net::TcpListener::bind("127.0.0.1:19230").await {
        Ok(listener) => {
            log::info!("MCP Server 已启动: http://127.0.0.1:19230/mcp");
            if let Err(e) = axum::serve(listener, router).await {
                log::error!("MCP Server 错误: {}", e);
            }
        }
        Err(e) => {
            log::error!("MCP Server 绑定端口 19230 失败: {}", e);
        }
    }
}
