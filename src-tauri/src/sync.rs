//! 多设备同步（阶段一）
//!
//! 传输：局域网 TCP 直连 + 同步包文件（异地兜底）
//! 合并：按 uuid 的 Last-Write-Wins（updated_at 较新者胜），is_deleted 作为墓碑同步
//! 说明：iroh 跨网 P2P 是下一阶段，将替换此处的 TCP 传输，合并内核不变（算法与传输解耦）

use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
use sqlx::{FromRow, SqlitePool};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::OnceCell;
use iroh::endpoint::presets;
use iroh::{Endpoint, EndpointId};
use uuid::Uuid;

/// 局域网同步监听端口
pub const SYNC_PORT: u16 = 38765;
/// 单个同步包大小上限（base64 内嵌图片可能较大，给 256MB）
const MAX_MSG: u32 = 256 * 1024 * 1024;

/// 同步用的笔记记录（带全局 uuid 身份）
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SyncNote {
    pub uuid: String,
    pub title: String,
    pub content: String,
    pub tags: String,
    pub is_favorite: i64,
    pub is_deleted: i64,
    pub created_at: String,
    pub updated_at: String,
    pub reminder_date: Option<String>,
    pub reminder_enabled: i64,
}

/// 同步附件（图片字节，base64 内联在同步包里；正文仍只存 attachment://hash 引用）
#[derive(Debug, Serialize, Deserialize)]
pub struct SyncAttachment {
    pub hash: String,
    pub ext: String,
    pub data: String,
}

/// 同步包（一次交换传输的内容）
#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPackage {
    pub version: u32,
    pub notes: Vec<SyncNote>,
    /// 正文引用到的图片附件（serde default 兼容旧版无此字段的包）
    #[serde(default)]
    pub attachments: Vec<SyncAttachment>,
    /// 发送方设备名（用于对端冲突副本标注来源；serde default 兼容旧包）
    #[serde(default)]
    pub device_name: String,
}

/// 同步结果统计
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    pub sent: usize,
    pub received: usize,
    pub inserted: usize,
    pub updated: usize,
    pub conflicts: usize,
}

/// 打开数据库连接池（确保 WAL + busy_timeout，与前端连接并发安全）
async fn open_pool(db_path: &str) -> Result<SqlitePool, String> {
    let opts = SqliteConnectOptions::new()
        .filename(db_path)
        .busy_timeout(Duration::from_secs(5))
        .journal_mode(SqliteJournalMode::Wal)
        .create_if_missing(false);
    SqlitePool::connect_with(opts)
        .await
        .map_err(|e| format!("打开数据库失败: {}", e))
}

/// 读取本地全部笔记（仅含已回填 uuid 的）
async fn read_local_notes(pool: &SqlitePool) -> Result<Vec<SyncNote>, String> {
    sqlx::query_as::<_, SyncNote>(
        "SELECT uuid,title,content,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled \
         FROM notes WHERE uuid IS NOT NULL AND uuid != ''",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("读取本地笔记失败: {}", e))
}

/// 从正文提取所有 attachment://<hash> 引用的 hash
fn find_attachment_hashes(content: &str) -> Vec<String> {
    let marker = "attachment://";
    let mut hashes = Vec::new();
    let mut rest = content;
    while let Some(pos) = rest.find(marker) {
        let after = &rest[pos + marker.len()..];
        let hash: String = after.chars().take_while(|c| c.is_ascii_hexdigit()).collect();
        rest = &after[hash.len()..];
        if !hash.is_empty() {
            hashes.push(hash);
        }
    }
    hashes
}

/// 收集这批笔记正文引用到的附件（base64 内联进同步包，对端去重落盘）
fn collect_attachments(app: &AppHandle, notes: &[SyncNote]) -> Vec<SyncAttachment> {
    use base64::Engine;
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    for n in notes {
        for hash in find_attachment_hashes(&n.content) {
            if !seen.insert(hash.clone()) {
                continue;
            }
            if let Ok(Some(bytes)) = crate::attachments::read_bytes(app, &hash) {
                let ext = crate::attachments::find_ext(app, &hash)
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "png".to_string());
                let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
                result.push(SyncAttachment { hash, ext, data });
            }
        }
    }
    result
}

/// 把对端传来的附件按 hash 落盘（内容寻址去重，已存在则跳过）
fn save_attachments(app: &AppHandle, atts: &[SyncAttachment]) {
    use base64::Engine;
    for a in atts {
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(a.data.as_bytes()) {
            let _ = crate::attachments::save_bytes(app, &bytes, &a.ext);
        }
    }
}

/// 清理无引用的图片附件（手动触发）：扫描所有笔记 content + synced_content 的引用，删除没人用的附件文件
pub async fn gc_attachments(app: &AppHandle, db_path: &str) -> Result<(usize, u64), String> {
    let pool = open_pool(db_path).await?;
    let rows: Vec<(String, Option<String>)> =
        sqlx::query_as("SELECT content, synced_content FROM notes")
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("读取笔记失败: {}", e))?;
    pool.close().await;
    let mut referenced = std::collections::HashSet::new();
    for (content, synced) in &rows {
        for h in find_attachment_hashes(content) {
            referenced.insert(h);
        }
        if let Some(s) = synced {
            for h in find_attachment_hashes(s) {
                referenced.insert(h);
            }
        }
    }
    crate::attachments::gc_unreferenced(app, &referenced)
}

/// 本地笔记的完整状态（含同步基准 synced_content = 共同祖先 base）
#[derive(Debug, FromRow)]
struct LocalNote {
    content: String,
    #[allow(dead_code)]
    title: String,
    #[allow(dead_code)]
    tags: String,
    #[allow(dead_code)]
    is_favorite: i64,
    is_deleted: i64,
    #[allow(dead_code)]
    created_at: String,
    updated_at: String,
    #[allow(dead_code)]
    reminder_date: Option<String>,
    #[allow(dead_code)]
    reminder_enabled: i64,
    synced_content: Option<String>,
}

/// 当前时间，ISO8601（与前端 toISOString 一致，便于字典序比较）
fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// 把对端笔记另存为一条"冲突副本"新笔记（绝不丢数据：两版都保留）
async fn create_conflict_copy(pool: &SqlitePool, remote: &SyncNote, peer_name: &str) -> Result<(), String> {
    let new_uuid = Uuid::new_v4().to_string();
    let now = now_iso();
    let from = if peer_name.is_empty() { String::new() } else { format!("来自{} ", peer_name) };
    let title = format!("{}（冲突副本 {}{}）", remote.title, from, &now[..10.min(now.len())]);
    sqlx::query(
        "INSERT INTO notes (uuid,title,content,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled,synced_content,has_conflict) \
         VALUES (?,?,?,?,?,?,?,?,?,?,?,1)",
    )
    .bind(&new_uuid).bind(&title).bind(&remote.content).bind(&remote.tags)
    .bind(remote.is_favorite).bind(0i64).bind(&remote.created_at).bind(&now)
    .bind(&remote.reminder_date).bind(remote.reminder_enabled).bind(&remote.content)
    .execute(pool)
    .await
    .map_err(|e| format!("创建冲突副本失败: {}", e))?;
    Ok(())
}

/// 用对端版本整体覆盖本地（content + 元数据 + 基准），并清除冲突标记
async fn apply_remote(pool: &SqlitePool, n: &SyncNote) -> Result<(), String> {
    sqlx::query(
        "UPDATE notes SET title=?,content=?,tags=?,is_favorite=?,is_deleted=?,created_at=?,updated_at=?,reminder_date=?,reminder_enabled=?,synced_content=?,has_conflict=0 \
         WHERE uuid=?",
    )
    .bind(&n.title).bind(&n.content).bind(&n.tags)
    .bind(n.is_favorite).bind(n.is_deleted).bind(&n.created_at).bind(&n.updated_at)
    .bind(&n.reminder_date).bind(n.reminder_enabled).bind(&n.content).bind(&n.uuid)
    .execute(pool)
    .await
    .map_err(|e| format!("更新失败: {}", e))?;
    Ok(())
}

/// git 式三路合并：base(共同祖先 synced_content) / local(本地) / remote(对端)
/// 绝不静默丢数据：仅一方改→取那方；两方改不同处→自动合并；两方改同处→冲突副本。
/// 返回 (inserted, updated, conflicts)
async fn merge_notes(pool: &SqlitePool, remote: &[SyncNote], peer_name: &str) -> Result<(usize, usize, usize), String> {
    let mut inserted = 0usize;
    let mut updated = 0usize;
    let mut conflicts = 0usize;
    for n in remote {
        if n.uuid.is_empty() {
            continue;
        }
        let local: Option<LocalNote> = sqlx::query_as::<_, LocalNote>(
            "SELECT content,title,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled,synced_content \
             FROM notes WHERE uuid = ?",
        )
        .bind(&n.uuid)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("查询失败: {}", e))?;

        // 本地不存在 → 直接插入，基准设为对端内容
        let l = match local {
            None => {
                sqlx::query(
                    "INSERT INTO notes (uuid,title,content,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled,synced_content,has_conflict) \
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,0)",
                )
                .bind(&n.uuid).bind(&n.title).bind(&n.content).bind(&n.tags)
                .bind(n.is_favorite).bind(n.is_deleted).bind(&n.created_at).bind(&n.updated_at)
                .bind(&n.reminder_date).bind(n.reminder_enabled).bind(&n.content)
                .execute(pool)
                .await
                .map_err(|e| format!("插入失败: {}", e))?;
                inserted += 1;
                continue;
            }
            Some(l) => l,
        };

        // 内容完全一致：按 updated_at 处理元数据，并刷新基准
        if l.content == n.content {
            if n.updated_at > l.updated_at {
                apply_remote(pool, n).await?;
                updated += 1;
            } else {
                sqlx::query("UPDATE notes SET synced_content=? WHERE uuid=?")
                    .bind(&n.content).bind(&n.uuid)
                    .execute(pool).await.map_err(|e| e.to_string())?;
            }
            continue;
        }

        let base = l.synced_content.clone();
        let local_changed = base.as_deref() != Some(l.content.as_str());
        let remote_changed = base.as_deref() != Some(n.content.as_str());

        // ---- 删除 vs 编辑：删除绝不静默吞掉编辑 ----
        if n.is_deleted == 1 && l.is_deleted == 0 && local_changed {
            // 远端删除、本地仍在编辑 → 保留本地，不删
            conflicts += 1;
            continue;
        }
        if l.is_deleted == 1 && n.is_deleted == 0 && remote_changed {
            // 本地删除、远端有编辑 → 恢复并采用远端编辑
            apply_remote(pool, n).await?;
            conflicts += 1;
            continue;
        }

        // ---- 无共同祖先（首次同步/老数据）且内容不同 → 冲突副本兜底 ----
        let base = match base {
            None => {
                create_conflict_copy(pool, n, peer_name).await?;
                sqlx::query("UPDATE notes SET synced_content=? WHERE uuid=?")
                    .bind(&l.content).bind(&n.uuid)
                    .execute(pool).await.map_err(|e| e.to_string())?;
                conflicts += 1;
                continue;
            }
            Some(b) => b,
        };

        match (local_changed, remote_changed) {
            // 仅远端改 → 采用远端
            (false, true) => {
                apply_remote(pool, n).await?;
                updated += 1;
            }
            // 仅本地改 → 保留本地（对端是旧版，基准不变）
            (true, false) => {}
            // 理论不可达，兜底采用远端
            (false, false) => {
                apply_remote(pool, n).await?;
                updated += 1;
            }
            // 两端都改 → diffy 三路合并
            (true, true) => match diffy::merge(&base, &l.content, &n.content) {
                Ok(merged) => {
                    // 改的是不同段落 → 自动合并，两边改动都保留
                    let new_updated = if n.updated_at > l.updated_at { &n.updated_at } else { &l.updated_at };
                    sqlx::query(
                        "UPDATE notes SET content=?,synced_content=?,updated_at=?,has_conflict=0 WHERE uuid=?",
                    )
                    .bind(&merged).bind(&merged).bind(new_updated).bind(&n.uuid)
                    .execute(pool).await.map_err(|e| format!("合并写入失败: {}", e))?;
                    updated += 1;
                }
                Err(_conflict_text) => {
                    // 改了同一处 → 真冲突：远端另存冲突副本，本地保留，基准推进到远端避免重复冲突
                    create_conflict_copy(pool, n, peer_name).await?;
                    sqlx::query("UPDATE notes SET synced_content=?,has_conflict=1 WHERE uuid=?")
                        .bind(&n.content).bind(&n.uuid)
                        .execute(pool).await.map_err(|e| e.to_string())?;
                    conflicts += 1;
                }
            },
        }
    }
    Ok((inserted, updated, conflicts))
}

/// 写一条长度前缀消息
async fn write_msg(stream: &mut TcpStream, bytes: &[u8]) -> Result<(), String> {
    stream.write_u32(bytes.len() as u32).await.map_err(|e| e.to_string())?;
    stream.write_all(bytes).await.map_err(|e| e.to_string())?;
    stream.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 读一条长度前缀消息
async fn read_msg(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let len = stream.read_u32().await.map_err(|e| e.to_string())?;
    if len > MAX_MSG {
        return Err(format!("同步包过大: {} 字节", len));
    }
    let mut buf = vec![0u8; len as usize];
    stream.read_exact(&mut buf).await.map_err(|e| e.to_string())?;
    Ok(buf)
}

/// 发起方：连接对端地址，完成一次双向同步（先发本地，后收对端并合并）
pub async fn sync_connect(app: AppHandle, db_path: &str, addr: &str) -> Result<SyncStats, String> {
    let pool = open_pool(db_path).await?;
    let local = read_local_notes(&pool).await?;
    let sent = local.len();
    let attachments = collect_attachments(&app, &local);
    let pkg = SyncPackage { version: 1, notes: local, attachments, device_name: local_device_name(&app) };
    let bytes = serde_json::to_vec(&pkg).map_err(|e| e.to_string())?;

    let mut stream = TcpStream::connect(addr)
        .await
        .map_err(|e| format!("连接 {} 失败: {}", addr, e))?;
    write_msg(&mut stream, &bytes).await?;
    let resp = read_msg(&mut stream).await?;
    let remote: SyncPackage =
        serde_json::from_slice(&resp).map_err(|e| format!("解析对端数据失败: {}", e))?;
    save_attachments(&app, &remote.attachments);
    let received = remote.notes.len();
    let (inserted, updated, conflicts) = merge_notes(&pool, &remote.notes, &remote.device_name).await?;
    pool.close().await;

    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(SyncStats { sent, received, inserted, updated, conflicts })
}

/// 接收方：处理一个进来的同步连接（先收对端，后发本地，再合并）
async fn handle_conn(app: AppHandle, db_path: String, mut stream: TcpStream) -> Result<(), String> {
    let req = read_msg(&mut stream).await?;
    let remote: SyncPackage =
        serde_json::from_slice(&req).map_err(|e| format!("解析对端数据失败: {}", e))?;
    let pool = open_pool(&db_path).await?;
    save_attachments(&app, &remote.attachments);
    let local = read_local_notes(&pool).await?;
    let attachments = collect_attachments(&app, &local);
    let pkg = SyncPackage { version: 1, notes: local, attachments, device_name: local_device_name(&app) };
    let bytes = serde_json::to_vec(&pkg).map_err(|e| e.to_string())?;
    write_msg(&mut stream, &bytes).await?;
    let (inserted, updated, conflicts) = merge_notes(&pool, &remote.notes, &remote.device_name).await?;
    pool.close().await;
    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(())
}

static LISTENER_STARTED: AtomicBool = AtomicBool::new(false);

/// 启动局域网同步监听（幂等，重复调用只启动一次）
pub fn start_listener(app: AppHandle, db_path: String) {
    if LISTENER_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind(("0.0.0.0", SYNC_PORT)).await {
            Ok(l) => l,
            Err(e) => {
                log::error!("同步监听启动失败: {}", e);
                LISTENER_STARTED.store(false, Ordering::SeqCst);
                return;
            }
        };
        log::info!("同步监听已启动: 0.0.0.0:{}", SYNC_PORT);
        loop {
            match listener.accept().await {
                Ok((stream, peer)) => {
                    log::info!("收到同步连接: {}", peer);
                    let app2 = app.clone();
                    let db2 = db_path.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = handle_conn(app2, db2, stream).await {
                            log::error!("处理同步连接失败: {}", e);
                        }
                    });
                }
                Err(e) => {
                    log::error!("接受同步连接失败: {}", e);
                }
            }
        }
    });
}

/// 获取本机局域网出口 IP（不实际发包，仅用于显示给用户）
pub fn local_ip() -> String {
    use std::net::UdpSocket;
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

/// 本设备名称（空则给个默认，发送同步包时带上）
fn local_device_name(app: &AppHandle) -> String {
    crate::db::get_device_name(app)
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "未命名设备".to_string())
}

/// 导出同步包为 JSON 字符串（异地手动传输用，内联图片附件，自包含）
pub async fn export_package(app: &AppHandle, db_path: &str) -> Result<String, String> {
    let pool = open_pool(db_path).await?;
    let notes = read_local_notes(&pool).await?;
    pool.close().await;
    let attachments = collect_attachments(app, &notes);
    let pkg = SyncPackage { version: 1, notes, attachments, device_name: local_device_name(app) };
    serde_json::to_string(&pkg).map_err(|e| e.to_string())
}

/// 导入同步包（合并入本地）
pub async fn import_package(app: AppHandle, db_path: &str, json_data: &str) -> Result<SyncStats, String> {
    let pkg: SyncPackage =
        serde_json::from_str(json_data).map_err(|e| format!("解析同步包失败: {}", e))?;
    save_attachments(&app, &pkg.attachments);
    let received = pkg.notes.len();
    let pool = open_pool(db_path).await?;
    let (inserted, updated, conflicts) = merge_notes(&pool, &pkg.notes, &pkg.device_name).await?;
    pool.close().await;
    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(SyncStats { sent: 0, received, inserted, updated, conflicts })
}

// ============= iroh 跨网 P2P 同步（阶段二） =============
//
// 复用上面的 SyncPackage 序列化 + merge_notes 合并内核，仅把传输从局域网 TCP
// 换成 iroh QUIC 流（自带 NAT 打洞 + relay 中继 + 端到端 TLS 加密）。
// 配对方式：交换本机 EndpointId（公钥字符串），靠 iroh 的 relay/discovery 找到对端。

/// iroh 同步协议 ALPN
const IROH_ALPN: &[u8] = b"jdnotes-sync/0";

/// 全局 iroh Endpoint（首次使用时初始化并启动接收循环）
static IROH_EP: OnceCell<Endpoint> = OnceCell::const_new();

/// 获取或初始化全局 iroh Endpoint（幂等），并启动接收循环
async fn get_iroh_endpoint(app: AppHandle, db_path: String) -> Result<Endpoint, String> {
    let ep = IROH_EP
        .get_or_try_init(|| async {
            let ep = Endpoint::builder(presets::N0)
                .alpns(vec![IROH_ALPN.to_vec()])
                .bind()
                .await
                .map_err(|e| format!("iroh 启动失败: {}", e))?;
            log::info!("iroh endpoint 已启动, id={}", ep.id());
            let ep_clone = ep.clone();
            let app_clone = app.clone();
            let db_clone = db_path.clone();
            tauri::async_runtime::spawn(async move {
                iroh_accept_loop(ep_clone, app_clone, db_clone).await;
            });
            Ok::<Endpoint, String>(ep)
        })
        .await?;
    Ok(ep.clone())
}

/// 接收循环：接受对端连接，作为接收方完成一次同步
async fn iroh_accept_loop(ep: Endpoint, app: AppHandle, db_path: String) {
    loop {
        match ep.accept().await {
            Some(incoming) => {
                let app2 = app.clone();
                let db2 = db_path.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = handle_iroh_conn(incoming, app2, db2).await {
                        log::error!("iroh 同步连接处理失败: {}", e);
                    }
                });
            }
            None => {
                log::info!("iroh endpoint 已关闭，接收循环退出");
                break;
            }
        }
    }
}

/// 接收方：先收对端同步包，再发本地包，最后合并
async fn handle_iroh_conn(
    incoming: iroh::endpoint::Incoming,
    app: AppHandle,
    db_path: String,
) -> Result<(), String> {
    let conn = incoming.await.map_err(|e| format!("接受连接失败: {}", e))?;
    let (mut send, mut recv) = conn.accept_bi().await.map_err(|e| e.to_string())?;
    let req = recv
        .read_to_end(MAX_MSG as usize)
        .await
        .map_err(|e| e.to_string())?;
    let remote: SyncPackage =
        serde_json::from_slice(&req).map_err(|e| format!("解析对端数据失败: {}", e))?;
    let pool = open_pool(&db_path).await?;
    save_attachments(&app, &remote.attachments);
    let local = read_local_notes(&pool).await?;
    let attachments = collect_attachments(&app, &local);
    let bytes = serde_json::to_vec(&SyncPackage { version: 1, notes: local, attachments, device_name: local_device_name(&app) }).map_err(|e| e.to_string())?;
    send.write_all(&bytes).await.map_err(|e| e.to_string())?;
    send.finish().map_err(|e| e.to_string())?;
    let (inserted, updated, conflicts) = merge_notes(&pool, &remote.notes, &remote.device_name).await?;
    pool.close().await;
    conn.closed().await;
    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(())
}

/// 获取本机 iroh 设备 ID（用于配对），确保 endpoint 与接收循环已启动
pub async fn iroh_get_id(app: AppHandle, db_path: String) -> Result<String, String> {
    let ep = get_iroh_endpoint(app, db_path).await?;
    Ok(ep.id().to_string())
}

/// 发起方：通过对端 iroh 设备 ID 连接并完成一次双向同步
pub async fn iroh_sync_connect(
    app: AppHandle,
    db_path: &str,
    peer_id: &str,
) -> Result<SyncStats, String> {
    let peer: EndpointId = peer_id
        .trim()
        .parse()
        .map_err(|e| format!("无效的设备 ID: {}", e))?;
    let ep = get_iroh_endpoint(app.clone(), db_path.to_string()).await?;
    let conn = ep
        .connect(peer, IROH_ALPN)
        .await
        .map_err(|e| format!("连接对端失败: {}", e))?;
    let (mut send, mut recv) = conn.open_bi().await.map_err(|e| e.to_string())?;
    let pool = open_pool(db_path).await?;
    let local = read_local_notes(&pool).await?;
    let sent = local.len();
    let attachments = collect_attachments(&app, &local);
    let bytes = serde_json::to_vec(&SyncPackage { version: 1, notes: local, attachments, device_name: local_device_name(&app) }).map_err(|e| e.to_string())?;
    send.write_all(&bytes).await.map_err(|e| e.to_string())?;
    send.finish().map_err(|e| e.to_string())?;
    let resp = recv
        .read_to_end(MAX_MSG as usize)
        .await
        .map_err(|e| e.to_string())?;
    let remote: SyncPackage =
        serde_json::from_slice(&resp).map_err(|e| format!("解析对端数据失败: {}", e))?;
    save_attachments(&app, &remote.attachments);
    let received = remote.notes.len();
    let (inserted, updated, conflicts) = merge_notes(&pool, &remote.notes, &remote.device_name).await?;
    pool.close().await;
    conn.close(0u8.into(), b"done");
    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(SyncStats { sent, received, inserted, updated, conflicts })
}
