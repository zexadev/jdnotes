use crate::db;
use crate::models::ExportData;

// ============= 架构说明 =============
// JD Notes 使用 tauri-plugin-sql 插件在前端直接执行 SQL 操作
// 笔记和聊天消息的 CRUD 操作都在前端 src/lib/db.ts 中实现
// 后端命令仅用于：
// 1. 数据库路径管理（获取/更改数据库位置）
// 2. 数据导入导出

// ============= 数据库路径管理 =============

/// 获取当前数据库路径
#[tauri::command]
pub async fn get_database_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = db::get_database_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}

/// 获取数据库信息
#[tauri::command]
pub async fn get_database_info(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = db::get_database_path(&app)?;
    let exists = db::database_exists(&app)?;
    let size = db::get_database_size(&app)?;
    let config = db::load_config(&app)?;
    let is_custom = config.database_path.is_some();
    
    Ok(serde_json::json!({
        "path": path.to_string_lossy().to_string(),
        "exists": exists,
        "size": size,
        "size_formatted": format_size(size),
        "is_custom": is_custom
    }))
}

/// 更改数据库存储位置
#[tauri::command]
pub async fn change_database_location(app: tauri::AppHandle, new_dir: String) -> Result<String, String> {
    log::info!("change_database_location called with: {}", new_dir);
    match db::change_database_location(&app, &new_dir) {
        Ok(path) => {
            log::info!("Database location changed to: {}", path);
            Ok(path)
        }
        Err(e) => {
            log::error!("Failed to change database location: {}", e);
            Err(e)
        }
    }
}

/// 格式化文件大小
fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    
    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// 复制数据库到新位置
#[tauri::command]
pub async fn copy_database_to(app: tauri::AppHandle, new_path: String) -> Result<(), String> {
    db::copy_database(&app, &new_path)
}

// ============= 数据导入导出 =============

/// 导出数据库为 JSON
#[tauri::command]
pub async fn export_database_json() -> Result<String, String> {
    let export_data = ExportData {
        version: "1.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        notes: vec![],
        chat_messages: vec![],
    };
    
    serde_json::to_string_pretty(&export_data).map_err(|e| e.to_string())
}

/// 从 JSON 导入数据
#[tauri::command]
pub async fn import_database_json(json_data: String) -> Result<serde_json::Value, String> {
    let import_data: ExportData = serde_json::from_str(&json_data)
        .map_err(|e| format!("JSON 解析失败: {}", e))?;
    
    // 返回导入统计
    Ok(serde_json::json!({
        "notes_count": import_data.notes.len(),
        "messages_count": import_data.chat_messages.len()
    }))
}

/// 从 IndexedDB 数据导入
#[tauri::command]
pub async fn import_from_indexeddb(data: serde_json::Value) -> Result<serde_json::Value, String> {
    // 解析 IndexedDB 导出的数据格式
    let notes = data.get("notes").and_then(|v| v.as_array());
    let messages = data.get("chatMessages").and_then(|v| v.as_array());
    
    let notes_count = notes.map(|n| n.len()).unwrap_or(0);
    let messages_count = messages.map(|m| m.len()).unwrap_or(0);
    
    Ok(serde_json::json!({
        "success": true,
        "notes_imported": notes_count,
        "messages_imported": messages_count
    }))
}

// ============= 初始化相关 =============

/// 获取数据库 URL
#[tauri::command]
pub async fn get_database_url(app: tauri::AppHandle) -> Result<String, String> {
    db::get_database_url(&app)
}

// ============= AI 配置管理 =============

/// 获取 AI 配置（所有来源 + 激活 ID）
#[tauri::command]
pub async fn get_ai_config(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let (sources, active_source_id) = db::get_ai_config(&app)?;
    let sources_json: Vec<serde_json::Value> = sources.iter().map(|s| {
        let provider_str = match s.provider {
            db::AIProvider::OpenAICompatible => "openai",
            db::AIProvider::Anthropic => "anthropic",
            db::AIProvider::Google => "google",
            db::AIProvider::Ollama => "ollama",
        };
        serde_json::json!({
            "id": s.id,
            "name": s.name,
            "provider": provider_str,
            "baseUrl": s.base_url,
            "apiKey": s.api_key,
            "model": s.model
        })
    }).collect();

    Ok(serde_json::json!({
        "sources": sources_json,
        "activeSourceId": active_source_id
    }))
}

/// 保存 AI 配置（所有来源 + 激活 ID）
#[tauri::command]
pub async fn save_ai_config(
    app: tauri::AppHandle,
    sources: Vec<serde_json::Value>,
    active_source_id: String,
) -> Result<(), String> {
    let ai_sources: Vec<db::AISource> = sources.iter().map(|s| {
        let provider_str = s.get("provider").and_then(|v| v.as_str()).unwrap_or("openai");
        let provider = match provider_str {
            "anthropic" => db::AIProvider::Anthropic,
            "google" => db::AIProvider::Google,
            "ollama" => db::AIProvider::Ollama,
            _ => db::AIProvider::OpenAICompatible,
        };
        db::AISource {
            id: s.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: s.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            provider,
            base_url: s.get("baseUrl").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            api_key: s.get("apiKey").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            model: s.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        }
    }).collect();

    db::save_ai_config(&app, ai_sources, active_source_id)?;
    Ok(())
}

/// 获取配置文件路径
#[tauri::command]
pub async fn get_config_path(app: tauri::AppHandle) -> Result<String, String> {
    db::get_config_file_path(&app)
}

// ============= 联网功能 =============

/// 搜索网页（通过 DuckDuckGo HTML 搜索）
#[tauri::command]
pub async fn web_search(query: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .post("https://html.duckduckgo.com/html/")
        .form(&[("q", &query)])
        .send()
        .await
        .map_err(|e| format!("搜索请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("搜索失败: HTTP {}", response.status()));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("读取搜索结果失败: {}", e))?;

    // 解析 DuckDuckGo HTML 搜索结果
    let document = scraper::Html::parse_document(&html);
    let result_selector = scraper::Selector::parse(".result.results_links").unwrap();
    let title_selector = scraper::Selector::parse(".result__a").unwrap();
    let snippet_selector = scraper::Selector::parse(".result__snippet").unwrap();
    let url_selector = scraper::Selector::parse(".result__url").unwrap();

    let mut results = Vec::new();
    for (i, result) in document.select(&result_selector).enumerate() {
        if i >= 8 { break; } // 最多 8 条结果

        let title = result
            .select(&title_selector)
            .next()
            .map(|e| e.text().collect::<String>())
            .unwrap_or_default();

        let snippet = result
            .select(&snippet_selector)
            .next()
            .map(|e| e.text().collect::<String>())
            .unwrap_or_default();

        let url = result
            .select(&url_selector)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        if !title.is_empty() {
            results.push(format!("{}. {}\n   {}\n   {}", i + 1, title.trim(), url.trim(), snippet.trim()));
        }
    }

    if results.is_empty() {
        Ok(format!("没有找到关于「{}」的搜索结果", query))
    } else {
        Ok(results.join("\n\n"))
    }
}

/// 读取网页内容（直接抓取并提取正文）
#[tauri::command]
pub async fn web_fetch(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("网页请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("网页读取失败: HTTP {}", response.status()));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("读取网页内容失败: {}", e))?;

    // 提取正文文本
    let document = scraper::Html::parse_document(&html);

    // 移除 script 和 style 内容，提取文本
    let body_selector = scraper::Selector::parse("body").unwrap();
    let script_selector = scraper::Selector::parse("script, style, nav, footer, header").unwrap();

    let body = document.select(&body_selector).next();
    let mut text = String::new();

    if let Some(body_el) = body {
        // 收集要排除的节点
        let skip_ids: std::collections::HashSet<ego_tree::NodeId> = body_el
            .select(&script_selector)
            .map(|e| e.id())
            .collect();

        for node_ref in body_el.descendants() {
            // 跳过被排除节点的子节点
            let mut should_skip = false;
            let mut current = node_ref.parent();
            while let Some(parent) = current {
                if skip_ids.contains(&parent.id()) {
                    should_skip = true;
                    break;
                }
                current = parent.parent();
            }
            if should_skip { continue; }

            if let scraper::Node::Text(ref text_node) = node_ref.value() {
                let t = text_node.text.trim();
                if !t.is_empty() {
                    text.push_str(t);
                    text.push('\n');
                }
            }
        }
    }

    // 清理多余空行
    let cleaned: String = text
        .lines()
        .filter(|l| !l.trim().is_empty())
        .collect::<Vec<&str>>()
        .join("\n");

    // 限制长度
    Ok(cleaned.chars().take(8000).collect())
}

/// 获取用户大致位置（通过 IP 定位）
#[tauri::command]
pub async fn get_location() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get("http://ip-api.com/json/?fields=city,regionName,country&lang=zh-CN")
        .send()
        .await
        .map_err(|e| format!("定位请求失败: {}", e))?;

    let text = response
        .text()
        .await
        .map_err(|e| format!("读取定位结果失败: {}", e))?;

    Ok(text)
}
