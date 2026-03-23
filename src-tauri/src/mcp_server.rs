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

/// MCP Server 实例
#[derive(Clone)]
pub struct JdNotesMcpServer {
    pool: Arc<SqlitePool>,
    #[allow(dead_code)]
    tool_router: ToolRouter<Self>,
}

impl JdNotesMcpServer {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool: Arc::new(pool),
            tool_router: Self::tool_router(),
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
    #[schemars(description = "要查找的笔记标题（模糊匹配）")]
    title: String,
    #[schemars(description = "要追加的内容，支持 Markdown 格式")]
    content: String,
}

/// update_note 工具参数
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpdateNoteParams {
    /// 要查找的笔记标题（模糊匹配）
    #[schemars(description = "要查找的笔记标题（模糊匹配）")]
    title: String,
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
    #[tool(description = "Create a new note in JD Notes / 在 JD Notes 中创建新笔记")]
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
            Ok(r) => Ok(CallToolResult::success(vec![Content::text(format!(
                "笔记创建成功，ID: {}",
                r.last_insert_rowid()
            ))])),
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "创建笔记失败: {}",
                e
            ))])),
        }
    }

    #[tool(description = "Find a note by title (fuzzy match) and append content / 按标题模糊匹配笔记并追加内容")]
    async fn append_note(
        &self,
        Parameters(params): Parameters<AppendNoteParams>,
    ) -> Result<CallToolResult, McpError> {
        let search_pattern = format!("%{}%", params.title);

        let note = sqlx::query(
            "SELECT id, title, content FROM notes WHERE title LIKE ?1 AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1"
        )
        .bind(&search_pattern)
        .fetch_optional(self.pool.as_ref())
        .await;

        match note {
            Ok(Some(row)) => {
                let id: i64 = row.get("id");
                let title: String = row.get("title");
                let existing_content: String = row.get("content");
                let now = chrono::Local::now()
                    .format("%Y-%m-%dT%H:%M:%S%.3fZ")
                    .to_string();
                let new_content = format!("{}\n\n{}", existing_content, params.content);

                match sqlx::query("UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3")
                    .bind(&new_content)
                    .bind(&now)
                    .bind(id)
                    .execute(self.pool.as_ref())
                    .await
                {
                    Ok(_) => Ok(CallToolResult::success(vec![Content::text(format!(
                        "内容已追加到笔记「{}」(ID: {})",
                        title, id
                    ))])),
                    Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                        "更新笔记失败: {}",
                        e
                    ))])),
                }
            }
            Ok(None) => Ok(CallToolResult::error(vec![Content::text(format!(
                "未找到标题匹配「{}」的笔记",
                params.title
            ))])),
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "查询笔记失败: {}",
                e
            ))])),
        }
    }

    #[tool(description = "Find a note by title (fuzzy match) and update its title, content or tags / 按标题模糊匹配笔记并修改内容")]
    async fn update_note(
        &self,
        Parameters(params): Parameters<UpdateNoteParams>,
    ) -> Result<CallToolResult, McpError> {
        let search_pattern = format!("%{}%", params.title);

        let note = sqlx::query(
            "SELECT id, title FROM notes WHERE title LIKE ?1 AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1"
        )
        .bind(&search_pattern)
        .fetch_optional(self.pool.as_ref())
        .await;

        match note {
            Ok(Some(row)) => {
                let id: i64 = row.get("id");
                let old_title: String = row.get("title");
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
                query = query.bind(id);

                match query.execute(self.pool.as_ref()).await {
                    Ok(_) => Ok(CallToolResult::success(vec![Content::text(format!(
                        "笔记「{}」(ID: {}) 已更新",
                        old_title, id
                    ))])),
                    Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                        "更新笔记失败: {}",
                        e
                    ))])),
                }
            }
            Ok(None) => Ok(CallToolResult::error(vec![Content::text(format!(
                "未找到标题匹配「{}」的笔记",
                params.title
            ))])),
            Err(e) => Ok(CallToolResult::error(vec![Content::text(format!(
                "查询笔记失败: {}",
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
                "JD Notes MCP Server - 将内容保存到本地笔记应用。\n\n\
                 可用工具：\n\
                 - create_note: 创建新笔记（标题、内容、标签）\n\
                 - append_note: 按标题模糊匹配，追加内容到已有笔记",
            )
    }
}

/// 注册 MCP Server 到 Claude Code 配置（~/.claude.json）
pub fn register_in_claude_config() {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => {
            log::warn!("无法获取用户主目录，跳过 Claude Code MCP 注册");
            return;
        }
    };

    let config_path = home.join(".claude.json");

    let mut config: serde_json::Value = if config_path.exists() {
        match std::fs::read_to_string(&config_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({})),
            Err(_) => serde_json::json!({}),
        }
    } else {
        serde_json::json!({})
    };

    // 检查是否已注册
    let servers = config
        .as_object_mut()
        .unwrap()
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));

    if servers.get("jdnotes").is_some() {
        log::debug!("JDNotes MCP 已注册在 Claude Code 中");
        return;
    }

    // 注册
    servers.as_object_mut().unwrap().insert(
        "jdnotes".to_string(),
        serde_json::json!({
            "type": "http",
            "url": "http://127.0.0.1:19230/mcp"
        }),
    );

    match std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()) {
        Ok(_) => log::info!("已自动注册 JDNotes MCP 到 Claude Code"),
        Err(e) => log::warn!("写入 Claude Code 配置失败: {}", e),
    }
}

/// 启动 MCP HTTP Server
pub async fn start_mcp_server(db_path: PathBuf) {
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
        move || Ok(JdNotesMcpServer::new(pool.clone())),
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
