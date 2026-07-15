use crate::attachments;
use crate::db;
use crate::models::ExportData;
use crate::sync;

// ============= 架构说明 =============
// Lapis 使用 tauri-plugin-sql 插件在前端直接执行 SQL 操作
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
            db::AIProvider::Responses => "responses",
        };
        serde_json::json!({
            "id": s.id,
            "name": s.name,
            "provider": provider_str,
            "baseUrl": s.base_url,
            "apiKey": s.api_key,
            "model": s.model,
            "contextWindow": s.context_window
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
            "responses" => db::AIProvider::Responses,
            _ => db::AIProvider::OpenAICompatible,
        };
        db::AISource {
            id: s.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: s.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            provider,
            base_url: s.get("baseUrl").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            api_key: s.get("apiKey").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            model: s.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            context_window: s.get("contextWindow").and_then(|v| v.as_u64()).map(|v| v as u32),
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

/// 获取联网搜索 API 配置（提供商列表）
#[tauri::command]
pub async fn get_search_api_config(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let cfg = db::get_search_api(&app)?;
    // 归一化返回列表：把旧版单字段迁移进来，前端只需处理列表
    let mut providers = cfg.providers.clone();
    if providers.is_empty() && !cfg.provider.is_empty() && !cfg.api_key.is_empty() {
        providers.push(db::SearchProviderEntry {
            provider: cfg.provider.clone(),
            api_key: cfg.api_key.clone(),
            enabled: true,
        });
    }
    let list: Vec<serde_json::Value> = providers.iter().map(|p| {
        serde_json::json!({ "provider": p.provider, "apiKey": p.api_key, "enabled": p.enabled })
    }).collect();
    Ok(serde_json::json!({ "providers": list }))
}

/// 保存联网搜索 API 配置（提供商列表）
#[tauri::command]
pub async fn save_search_api_config(app: tauri::AppHandle, providers: Vec<serde_json::Value>) -> Result<(), String> {
    let entries: Vec<db::SearchProviderEntry> = providers.iter().map(|p| db::SearchProviderEntry {
        provider: p.get("provider").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        api_key: p.get("apiKey").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        enabled: p.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
    }).collect();
    db::set_search_api(&app, entries)
}

/// 获取本设备名称
#[tauri::command]
pub async fn get_device_name(app: tauri::AppHandle) -> Result<String, String> {
    db::get_device_name(&app)
}

/// 设置本设备名称
#[tauri::command]
pub async fn set_device_name(app: tauri::AppHandle, name: String) -> Result<(), String> {
    db::set_device_name(&app, name)?;
    // 设备名变更后立即重注册 mDNS，对方下次刷新就能看到新名字（不必等 TTL 过期）
    if let Err(e) = sync::mdns_reregister_device_name(&app).await {
        log::warn!("mDNS 重注册失败: {}", e);
    }
    Ok(())
}

// ============= 多设备同步 =============

/// 获取本机同步信息（局域网地址）并启动监听
#[tauri::command]
pub async fn sync_get_info(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::start_listener(app.clone(), db_path);
    let ip = sync::local_ip();
    Ok(serde_json::json!({
        "ip": ip,
        "port": sync::SYNC_PORT,
        "address": format!("{}:{}", ip, sync::SYNC_PORT),
    }))
}

/// 连接对端地址完成一次双向同步
#[tauri::command]
pub async fn sync_connect_lan(
    app: tauri::AppHandle,
    address: String,
) -> Result<sync::SyncStats, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::sync_connect(app.clone(), &db_path, &address).await
}

/// 导出同步包为 JSON 字符串（异地手动传输用）
#[tauri::command]
pub async fn sync_export_package(app: tauri::AppHandle) -> Result<String, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::export_package(&app, &db_path).await
}

/// 导入同步包（合并入本地）
#[tauri::command]
pub async fn sync_import_package(
    app: tauri::AppHandle,
    json_data: String,
) -> Result<sync::SyncStats, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::import_package(app.clone(), &db_path, &json_data).await
}

/// 获取本机 iroh 设备 ID（跨网配对用），并启动 iroh endpoint
#[tauri::command]
pub async fn sync_iroh_get_id(app: tauri::AppHandle) -> Result<String, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::iroh_get_id(app.clone(), db_path).await
}

/// 接受配对：把对端 fingerprint 加入后端权威白名单（接收端校验用）
#[tauri::command]
pub async fn sync_accept_pairing(app: tauri::AppHandle, fingerprint: String) -> Result<(), String> {
    db::add_paired(&app, &fingerprint)
}

/// 撤销配对：从白名单移除对端 fingerprint
#[tauri::command]
pub async fn sync_revoke_pairing(app: tauri::AppHandle, fingerprint: String) -> Result<(), String> {
    db::remove_paired(&app, &fingerprint)
}

/// 查询某对端 fingerprint 是否已配对
#[tauri::command]
pub async fn sync_is_paired(app: tauri::AppHandle, fingerprint: String) -> Result<bool, String> {
    Ok(db::is_paired(&app, &fingerprint))
}

/// 设置/取消某设备为「我的设备」（后端权威；mine=true 时要求已配对）
/// 决定该设备能否走全量双向同步——前端 localStorage 类型仅做 UI，权威以此为准
#[tauri::command]
pub async fn sync_set_device_kind(app: tauri::AppHandle, fingerprint: String, mine: bool) -> Result<(), String> {
    db::set_device_mine(&app, &fingerprint, mine)
}

/// 查询某设备是否为「我的设备」
#[tauri::command]
pub async fn sync_is_mine(app: tauri::AppHandle, fingerprint: String) -> Result<bool, String> {
    Ok(db::is_mine(&app, &fingerprint))
}

/// 通过对端 iroh 设备 ID 发起一次跨网双向同步
#[tauri::command]
pub async fn sync_iroh_connect(
    app: tauri::AppHandle,
    peer_id: String,
) -> Result<sync::SyncStats, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::iroh_sync_connect(app.clone(), &db_path, &peer_id).await
}

/// probe 对端：验证连通并取回对端设备名（"添加设备"时用，不传输笔记）
#[tauri::command]
pub async fn sync_iroh_probe(app: tauri::AppHandle, peer_id: String) -> Result<sync::ProbeResult, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::iroh_probe(app.clone(), &db_path, &peer_id).await
}

/// 主动推送单条笔记给对端（编辑器旁单条同步用）
#[tauri::command]
pub async fn sync_iroh_push_note(
    app: tauri::AppHandle,
    peer_id: String,
    note_id: i64,
) -> Result<sync::SyncStats, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::iroh_push_note(app.clone(), &db_path, &peer_id, note_id).await
}

/// 跨网多条推送：iroh 直连对端，只发选中的若干（「分享对象」类设备用）
#[tauri::command]
pub async fn sync_iroh_push_notes(
    app: tauri::AppHandle,
    peer_id: String,
    note_ids: Vec<i64>,
) -> Result<sync::SyncStats, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::iroh_push_notes(app.clone(), &db_path, &peer_id, note_ids).await
}

/// 局域网版的单条推送：TCP 直连地址，只发指定那一条
/// fingerprint：来自 mDNS 发现的设备会带上，用于校验应答方身份防 ARP 冒名；手输地址为 None
#[tauri::command]
pub async fn sync_lan_push_note(
    app: tauri::AppHandle,
    address: String,
    note_id: i64,
    fingerprint: Option<String>,
) -> Result<sync::SyncStats, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::lan_push_note(app.clone(), &db_path, &address, note_id, fingerprint.as_deref()).await
}

/// 局域网多条推送（笔记选择列表用）
/// fingerprint：来自 mDNS 发现的设备会带上，用于校验应答方身份防 ARP 冒名；手输地址为 None
#[tauri::command]
pub async fn sync_lan_push_notes(
    app: tauri::AppHandle,
    address: String,
    note_ids: Vec<i64>,
    fingerprint: Option<String>,
) -> Result<sync::SyncStats, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    sync::lan_push_notes(app.clone(), &db_path, &address, note_ids, fingerprint.as_deref()).await
}

/// 局域网设备发现（mDNS）
#[tauri::command]
pub async fn sync_lan_discover(
    app: tauri::AppHandle,
) -> Result<Vec<sync::DiscoveredDevice>, String> {
    sync::lan_discover(app).await
}

// ============= 图片附件 =============

/// 保存 base64 图片为附件，返回内容 hash（前端粘贴/选文件用）
#[tauri::command]
pub async fn save_attachment_base64(
    app: tauri::AppHandle,
    base64_data: String,
    ext: String,
) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("base64 解码失败: {}", e))?;
    attachments::save_bytes(&app, &bytes, &ext)
}

/// 从本地文件路径保存附件（系统拖拽用），返回 { hash, ext }
#[tauri::command]
pub async fn save_attachment_from_path(
    app: tauri::AppHandle,
    path: String,
) -> Result<serde_json::Value, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let hash = attachments::save_bytes(&app, &bytes, &ext)?;
    Ok(serde_json::json!({ "hash": hash, "ext": ext }))
}

/// 取附件文件绝对路径（供前端 convertFileSrc 渲染）
#[tauri::command]
pub async fn get_attachment_path(
    app: tauri::AppHandle,
    hash: String,
) -> Result<Option<String>, String> {
    Ok(attachments::find_path(&app, &hash)?.map(|p| p.to_string_lossy().to_string()))
}

/// 把附件读成 base64 data URL（导出自包含 JSON 时把 attachment:// 还原成内嵌图片）
#[tauri::command]
pub async fn read_attachment_data_url(
    app: tauri::AppHandle,
    hash: String,
) -> Result<Option<String>, String> {
    use base64::Engine;
    match attachments::read_bytes(&app, &hash)? {
        Some(bytes) => {
            let ext = attachments::find_ext(&app, &hash)?.unwrap_or_else(|| "png".to_string());
            let mime = match ext.as_str() {
                "jpg" | "jpeg" => "image/jpeg",
                "svg" => "image/svg+xml",
                "gif" => "image/gif",
                "webp" => "image/webp",
                "bmp" => "image/bmp",
                _ => "image/png",
            };
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Ok(Some(format!("data:{};base64,{}", mime, b64)))
        }
        None => Ok(None),
    }
}

/// 清理无引用的图片附件（手动），返回删除数量与释放字节
#[tauri::command]
pub async fn sync_gc_attachments(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db_path = db::get_database_path(&app)?.to_string_lossy().to_string();
    let (removed, freed) = sync::gc_attachments(&app, &db_path).await?;
    Ok(serde_json::json!({ "removed": removed, "freed": freed }))
}

// ============= 联网功能 =============

/// 构造带完整浏览器头的 HTTP 客户端（搜索引擎会对裸头/裸指纹请求返回无结果的挑战页）
fn search_client() -> Result<reqwest::Client, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::ACCEPT,
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8".parse().unwrap(),
    );
    headers.insert(reqwest::header::ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8".parse().unwrap());
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

struct SearchHit {
    title: String,
    url: String,
    snippet: String,
}

fn format_hits(hits: &[SearchHit]) -> String {
    hits.iter()
        .enumerate()
        .map(|(i, h)| format!("{}. {}\n   {}\n   {}", i + 1, h.title.trim(), h.url.trim(), h.snippet.trim()))
        .collect::<Vec<_>>()
        .join("\n\n")
}

// 相关性过滤：抓取引擎反爬后常整页返回不相关站点（"渭南天气"→Netflix）。
// 提取查询里的 latin 词（≥2 字符）与 CJK 二元组，任一命中标题/摘要即保留。
// 全部被过滤掉时返回空 → 触发下一引擎回退，好过把垃圾喂给模型。
fn query_terms(query: &str) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    // latin 单词
    for w in query.split(|c: char| !c.is_alphanumeric()) {
        let w = w.to_lowercase();
        if w.len() >= 2 && w.is_ascii() {
            terms.push(w);
        }
    }
    // CJK 二元组（连续汉字滑窗）
    let cjk: Vec<char> = query.chars().filter(|c| ('\u{4e00}'..='\u{9fff}').contains(c)).collect();
    for pair in cjk.windows(2) {
        terms.push(pair.iter().collect());
    }
    // 单字兜底（查询只有一两个汉字时）
    if terms.is_empty() {
        for c in cjk {
            terms.push(c.to_string());
        }
    }
    terms
}

fn filter_relevant(hits: Vec<SearchHit>, query: &str) -> Vec<SearchHit> {
    let terms = query_terms(query);
    if terms.is_empty() {
        return hits;
    }
    hits.into_iter()
        .filter(|h| {
            let hay = format!("{} {}", h.title, h.snippet).to_lowercase();
            terms.iter().any(|t| hay.contains(t.as_str()))
        })
        .collect()
}

/// 从 HTML 里按选择器提取搜索结果（title/url/snippet 选择器相对结果块）
fn scrape_hits(html: &str, block_sel: &str, title_sel: &str, url_sel: &str, snippet_sel: &str) -> Vec<SearchHit> {
    let document = scraper::Html::parse_document(html);
    let block = match scraper::Selector::parse(block_sel) { Ok(s) => s, Err(_) => return vec![] };
    let title = scraper::Selector::parse(title_sel).unwrap();
    let url = scraper::Selector::parse(url_sel).unwrap();
    let snippet = scraper::Selector::parse(snippet_sel).unwrap();

    let mut hits = Vec::new();
    for result in document.select(&block).take(8) {
        let t: String = result.select(&title).next().map(|e| e.text().collect()).unwrap_or_default();
        // url 选择器优先取 href（lite/bing 的可读 URL 就是链接本身）
        let u: String = result
            .select(&url)
            .next()
            .map(|e| {
                let text: String = e.text().collect();
                let text = text.trim().to_string();
                if text.is_empty() { e.value().attr("href").unwrap_or_default().to_string() } else { text }
            })
            .unwrap_or_default();
        let s: String = result.select(&snippet).next().map(|e| e.text().collect()).unwrap_or_default();
        if !t.trim().is_empty() {
            hits.push(SearchHit { title: t, url: u, snippet: s });
        }
    }
    hits
}

/// 从 RSS XML 里提取 item 的 title/link/description（RSS 结构简单，字符串切片即可，不引 XML 依赖）
fn parse_rss_hits(xml: &str) -> Vec<SearchHit> {
    fn tag_text(chunk: &str, tag: &str) -> String {
        let open = format!("<{}>", tag);
        let close = format!("</{}>", tag);
        let Some(s) = chunk.find(&open) else { return String::new() };
        let rest = &chunk[s + open.len()..];
        let Some(e) = rest.find(&close) else { return String::new() };
        decode_entities(rest[..e].trim())
    }
    fn decode_entities(s: &str) -> String {
        s.replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&amp;", "&")
    }
    xml.split("<item>")
        .skip(1)
        .take(8)
        .map(|chunk| {
            let chunk = chunk.split("</item>").next().unwrap_or(chunk);
            SearchHit {
                title: tag_text(chunk, "title"),
                url: tag_text(chunk, "link"),
                snippet: tag_text(chunk, "description"),
            }
        })
        .filter(|h| !h.title.trim().is_empty())
        .collect()
}

// Bing RSS：结构化输出、编码安全、结果相关性好——作为首选引擎
async fn search_bing_rss(client: &reqwest::Client, query: &str) -> Result<Vec<SearchHit>, String> {
    let resp = client
        .get("https://www.bing.com/search")
        .query(&[("q", query), ("format", "rss"), ("count", "8")])
        .send()
        .await
        .map_err(|e| format!("Bing: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Bing HTTP {}", resp.status()));
    }
    let xml = resp.text().await.map_err(|e| format!("Bing 读取失败: {}", e))?;
    Ok(filter_relevant(parse_rss_hits(&xml), query))
}

// DuckDuckGo Lite：表格布局，作为 Bing 不可用时的兜底
async fn search_ddg_lite(client: &reqwest::Client, query: &str) -> Result<Vec<SearchHit>, String> {
    let resp = client
        .post("https://lite.duckduckgo.com/lite/")
        .form(&[("q", query)])
        .send()
        .await
        .map_err(|e| format!("DDG lite: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("DDG lite HTTP {}", resp.status()));
    }
    let html = resp.text().await.map_err(|e| format!("DDG lite 读取失败: {}", e))?;
    let document = scraper::Html::parse_document(&html);
    let link_sel = scraper::Selector::parse("a.result-link").unwrap();
    let snip_sel = scraper::Selector::parse("td.result-snippet").unwrap();
    let links: Vec<_> = document.select(&link_sel).take(8).collect();
    let snippets: Vec<String> = document.select(&snip_sel).take(8).map(|e| e.text().collect()).collect();
    let hits: Vec<SearchHit> = links
        .iter()
        .enumerate()
        .map(|(i, a)| SearchHit {
            title: a.text().collect(),
            url: a.value().attr("href").unwrap_or_default().to_string(),
            snippet: snippets.get(i).cloned().unwrap_or_default(),
        })
        .filter(|h| !h.title.trim().is_empty())
        .collect();
    Ok(filter_relevant(hits, query))
}

// DuckDuckGo HTML：反爬后常返回不相关结果，作为最后兜底
async fn search_ddg_html(client: &reqwest::Client, query: &str) -> Result<Vec<SearchHit>, String> {
    let resp = client
        .post("https://html.duckduckgo.com/html/")
        .form(&[("q", query)])
        .send()
        .await
        .map_err(|e| format!("DDG html: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("DDG html HTTP {}", resp.status()));
    }
    let html = resp.text().await.map_err(|e| format!("DDG html 读取失败: {}", e))?;
    let hits = scrape_hits(&html, ".result.results_links", ".result__a", ".result__url", ".result__snippet");
    Ok(filter_relevant(hits, query))
}

// Tavily：专为 LLM 设计的搜索 API，返回干净的标题/URL/正文摘要，中英文都好
async fn search_tavily(client: &reqwest::Client, api_key: &str, query: &str) -> Result<Vec<SearchHit>, String> {
    let resp = client
        .post("https://api.tavily.com/search")
        .json(&serde_json::json!({
            "api_key": api_key,
            "query": query,
            "max_results": 8,
            "search_depth": "basic",
        }))
        .send()
        .await
        .map_err(|e| format!("Tavily: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Tavily HTTP {}（检查 API Key）", resp.status()));
    }
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Tavily 解析失败: {}", e))?;
    let hits = json["results"].as_array().map(|arr| {
        arr.iter().map(|r| SearchHit {
            title: r["title"].as_str().unwrap_or("").to_string(),
            url: r["url"].as_str().unwrap_or("").to_string(),
            snippet: r["content"].as_str().unwrap_or("").to_string(),
        }).filter(|h| !h.title.trim().is_empty()).collect()
    }).unwrap_or_default();
    Ok(hits)
}

// Brave Search API：独立索引，返回标准 web 结果
async fn search_brave(client: &reqwest::Client, api_key: &str, query: &str) -> Result<Vec<SearchHit>, String> {
    let resp = client
        .get("https://api.search.brave.com/res/v1/web/search")
        .header("X-Subscription-Token", api_key)
        .header("Accept", "application/json")
        .query(&[("q", query), ("count", "8")])
        .send()
        .await
        .map_err(|e| format!("Brave: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Brave HTTP {}（检查 API Key）", resp.status()));
    }
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Brave 解析失败: {}", e))?;
    let hits = json["web"]["results"].as_array().map(|arr| {
        arr.iter().map(|r| SearchHit {
            title: r["title"].as_str().unwrap_or("").to_string(),
            url: r["url"].as_str().unwrap_or("").to_string(),
            snippet: r["description"].as_str().unwrap_or("").to_string(),
        }).filter(|h| !h.title.trim().is_empty()).collect()
    }).unwrap_or_default();
    Ok(hits)
}

// Serper.dev：Google 结果，2500 次免费额度
async fn search_serper(client: &reqwest::Client, api_key: &str, query: &str) -> Result<Vec<SearchHit>, String> {
    let resp = client
        .post("https://google.serper.dev/search")
        .header("X-API-KEY", api_key)
        .json(&serde_json::json!({ "q": query, "num": 8 }))
        .send()
        .await
        .map_err(|e| format!("Serper: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Serper HTTP {}（检查 API Key）", resp.status()));
    }
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Serper 解析失败: {}", e))?;
    let hits = json["organic"].as_array().map(|arr| {
        arr.iter().take(8).map(|r| SearchHit {
            title: r["title"].as_str().unwrap_or("").to_string(),
            url: r["link"].as_str().unwrap_or("").to_string(),
            snippet: r["snippet"].as_str().unwrap_or("").to_string(),
        }).filter(|h| !h.title.trim().is_empty()).collect()
    }).unwrap_or_default();
    Ok(hits)
}

// Jina AI Search（s.jina.ai）：返回结果列表，X-Respond-With: no-content 只要标题/链接/摘要
async fn search_jina(client: &reqwest::Client, api_key: &str, query: &str) -> Result<Vec<SearchHit>, String> {
    let resp = client
        .get(format!("https://s.jina.ai/{}", urlencoding::encode(query)))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "application/json")
        .header("X-Respond-With", "no-content")
        .send()
        .await
        .map_err(|e| format!("Jina: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Jina HTTP {}（检查 API Key）", resp.status()));
    }
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Jina 解析失败: {}", e))?;
    let hits = json["data"].as_array().map(|arr| {
        arr.iter().take(8).map(|r| SearchHit {
            title: r["title"].as_str().unwrap_or("").to_string(),
            url: r["url"].as_str().unwrap_or("").to_string(),
            snippet: r["description"].as_str().unwrap_or("").to_string(),
        }).filter(|h| !h.title.trim().is_empty()).collect()
    }).unwrap_or_default();
    Ok(hits)
}

async fn call_search_provider(
    client: &reqwest::Client,
    provider: &str,
    api_key: &str,
    query: &str,
) -> Result<Vec<SearchHit>, String> {
    match provider {
        "tavily" => search_tavily(client, api_key, query).await,
        "brave" => search_brave(client, api_key, query).await,
        "serper" => search_serper(client, api_key, query).await,
        "jina" => search_jina(client, api_key, query).await,
        other => Err(format!("未知搜索提供商: {}", other)),
    }
}

// 轮换起点计数器：每次搜索换一个起始提供商，把各家月额度摊平使用
static SEARCH_ROTATION: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

/// 搜索网页：优先用配置的专业 API（Tavily/Brave，结果远优于抓取）；
/// 未配置时回退 Bing RSS → DuckDuckGo Lite → DuckDuckGo HTML 抓取。
/// 抓取对中文/生僻查询不可靠、反爬后常吐不相关结果，故推荐配置 API key。
#[tauri::command]
pub async fn web_search(app: tauri::AppHandle, query: String) -> Result<String, String> {
    let client = search_client()?;
    let mut errors: Vec<String> = Vec::new();

    macro_rules! try_engine {
        ($name:expr, $call:expr) => {
            match $call.await {
                Ok(hits) if !hits.is_empty() => return Ok(format_hits(&hits)),
                Ok(_) => errors.push(format!("{} 返回空结果", $name)),
                Err(e) => errors.push(e),
            }
        };
    }

    // 优先用配置的搜索 API：多提供商轮换，某个限流/失效自动切下一个，摊平各家免费额度。
    // 起点每次搜索递增（round-robin），避免总是先打爆同一家。
    if let Ok(cfg) = db::get_search_api(&app) {
        let providers = cfg.active_providers();
        if !providers.is_empty() {
            let start = SEARCH_ROTATION.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            for i in 0..providers.len() {
                let p = &providers[(start + i) % providers.len()];
                match call_search_provider(&client, &p.provider, &p.api_key, &query).await {
                    Ok(hits) if !hits.is_empty() => return Ok(format_hits(&hits)),
                    Ok(_) => errors.push(format!("{} 返回空结果", p.provider)),
                    Err(e) => errors.push(e),
                }
            }
        }
    }

    try_engine!("Bing", search_bing_rss(&client, &query));
    try_engine!("DDG lite", search_ddg_lite(&client, &query));
    try_engine!("DDG html", search_ddg_html(&client, &query));

    Ok(format!(
        "没有找到关于「{}」的搜索结果（{}）。若经常搜不到，建议在「设置 → AI」配置 Tavily/Brave 搜索 API Key。",
        query,
        errors.join("；")
    ))
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
