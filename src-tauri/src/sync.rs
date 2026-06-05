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
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::OnceCell;
use iroh::endpoint::presets;
use iroh::{Endpoint, EndpointId, PublicKey};
use std::str::FromStr;
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
    // 兜底：给没有 uuid 的笔记现场补一个，确保同步一定带上所有笔记
    // （即使前端 backfill 因任何原因没跑，同步引擎也自保）
    sqlx::query("UPDATE notes SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL OR uuid = ''")
        .execute(pool)
        .await
        .map_err(|e| format!("回填 uuid 失败: {}", e))?;
    sqlx::query_as::<_, SyncNote>(
        "SELECT uuid,title,content,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled \
         FROM notes WHERE uuid IS NOT NULL AND uuid != '' AND COALESCE(is_private, 0) = 0",
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
    /// 本地私有标记：1 = 该笔记被用户标为私有，入站同步绝不覆盖/复活它
    #[sqlx(default)]
    is_private: i64,
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
            "SELECT content,title,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled,synced_content,COALESCE(is_private,0) AS is_private \
             FROM notes WHERE uuid = ?",
        )
        .bind(&n.uuid)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("查询失败: {}", e))?;

        // 私有保护：本地已存在且被标为私有 → 入站数据绝不触碰它
        // （不覆盖内容、不复活已删、不生成冲突副本——私有笔记对同步完全不可见）
        if let Some(ref l) = local {
            if l.is_private == 1 {
                continue;
            }
        }

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
/// 安全：不按对端自报长度一次性预分配（防 256MB×N 连接内存放大 DoS），
/// 而是分块累积、读到多少分配多少；超 MAX_MSG 立即中断。
async fn read_msg(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let len = stream.read_u32().await.map_err(|e| e.to_string())?;
    if len > MAX_MSG {
        return Err(format!("同步包过大: {} 字节", len));
    }
    let len = len as usize;
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = vec![0u8; 64 * 1024];
    while buf.len() < len {
        let want = (len - buf.len()).min(chunk.len());
        let n = stream
            .read(&mut chunk[..want])
            .await
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("连接在读取完成前关闭".to_string());
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    Ok(buf)
}

/// 局域网握手认证帧：发起方对接收方的 challenge 用 iroh 私钥签名，
/// 证明自己持有声称的公钥（防 mDNS TXT 里 fp 被伪造）。
#[derive(Serialize, Deserialize)]
struct LanAuth {
    /// 公钥字符串（z-base-32，前 16 字符即 fingerprint）
    public_key: String,
    /// 对收到的 challenge 的 ed25519 签名（64 字节）
    signature: Vec<u8>,
    /// 反向认证：发起方对应答方下的 challenge（仅发起方填，应答方回包时为空）
    #[serde(default)]
    challenge: Vec<u8>,
}

/// 生成 32 字节一次性随机 challenge（两个 v4 UUID 拼接，各 122bit CSPRNG 熵）
fn gen_challenge() -> [u8; 32] {
    let mut c = [0u8; 32];
    c[..16].copy_from_slice(Uuid::new_v4().as_bytes());
    c[16..].copy_from_slice(Uuid::new_v4().as_bytes());
    c
}

/// 验证一条 LanAuth：对 challenge 验签，返回已验证的 (完整公钥串, fingerprint)
fn verify_lan_auth(auth: &LanAuth, challenge: &[u8]) -> Result<(String, String), String> {
    let pk = PublicKey::from_str(&auth.public_key).map_err(|e| format!("无效公钥: {}", e))?;
    if auth.signature.len() != 64 {
        return Err("签名长度错误".to_string());
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&auth.signature);
    let sig = iroh::Signature::from_bytes(&sig_arr);
    pk.verify(challenge, &sig)
        .map_err(|_| "签名验证失败：对端未持有声称的私钥".to_string())?;
    let fp: String = auth.public_key.chars().take(16).collect();
    Ok((auth.public_key.clone(), fp))
}

/// 本机 fingerprint（iroh 公钥前 16 字符），用于配对码与白名单
#[allow(dead_code)]
pub async fn local_fingerprint(app: &AppHandle, db_path: &str) -> Result<String, String> {
    let ep = get_iroh_endpoint(app.clone(), db_path.to_string()).await?;
    Ok(ep.id().to_string().chars().take(16).collect())
}

/// 接收端握手：发 challenge → 收发起方签名 → 验签。
/// 成功返回 (发起方完整公钥串, fingerprint, 发起方对本机下的 challenge)。
/// 最后一项供本机签名回证身份给发起方（双向认证）。
async fn lan_recv_handshake(stream: &mut TcpStream) -> Result<(String, String, Vec<u8>), String> {
    let challenge = gen_challenge();
    write_msg(stream, &challenge).await?;
    let auth_bytes = read_msg(stream).await?;
    let auth: LanAuth =
        serde_json::from_slice(&auth_bytes).map_err(|e| format!("解析认证帧失败: {}", e))?;
    let (pk, fp) = verify_lan_auth(&auth, &challenge)?;
    Ok((pk, fp, auth.challenge))
}

/// 发起端握手：收 challenge → 用本机私钥签名 + 附带本机对应答方的 challenge → 发认证帧。
/// 返回本机下发的 challenge，供随后验证应答方回证。
async fn lan_send_handshake(
    stream: &mut TcpStream,
    app: &AppHandle,
) -> Result<Vec<u8>, String> {
    let secret = load_or_create_iroh_secret(app)?;
    let challenge_r = read_msg(stream).await?;
    let sig = secret.sign(&challenge_r);
    let challenge_i = gen_challenge();
    let auth = LanAuth {
        public_key: secret.public().to_string(),
        signature: sig.to_bytes().to_vec(),
        challenge: challenge_i.to_vec(),
    };
    let bytes = serde_json::to_vec(&auth).map_err(|e| e.to_string())?;
    write_msg(stream, &bytes).await?;
    Ok(challenge_i.to_vec())
}

/// 发起端：连接地址 + 完成双向握手认证，返回已认证的 stream。
/// 不仅向应答方证明自己，还要求应答方回证身份（验签）——杀掉「冒名只回个 OK」的被动接管。
/// `expected_fp`：调用方已知目标设备指纹时（mDNS 发现并配对），要求应答方身份完全一致，
/// 防同网段 ARP 冒名顶替；手输地址无预期指纹（用户主动信任），仅验签不绑身份。
async fn lan_connect_authed(
    app: &AppHandle,
    addr: &str,
    expected_fp: Option<&str>,
) -> Result<TcpStream, String> {
    let mut stream = TcpStream::connect(addr)
        .await
        .map_err(|e| format!("连接 {} 失败: {}", addr, e))?;
    let challenge_i = lan_send_handshake(&mut stream, app).await?;
    let resp = read_msg(&mut stream).await?;
    // PAIRING_REQUIRED 表示对方需要先确认配对
    if resp == b"PAIRING_REQUIRED" {
        return Err("对方尚未确认配对：请在对方设备上接受配对请求后重试".to_string());
    }
    // 反向认证：解析应答方回证帧并验签（证明应答方确实持有其声称的私钥）
    let auth: LanAuth = serde_json::from_slice(&resp)
        .map_err(|_| "握手响应无效（对方可能为旧版或非 jdnotes 设备）".to_string())?;
    let (_resp_pk, resp_fp) = verify_lan_auth(&auth, &challenge_i)
        .map_err(|_| "对方身份验证失败（应答方未持有声称的私钥）".to_string())?;
    if let Some(exp) = expected_fp {
        if resp_fp != exp {
            return Err("对方身份与所选设备不符（可能被同网段设备冒名顶替）".to_string());
        }
    }
    Ok(stream)
}

/// 发起方：连接对端地址，完成一次双向同步（先发本地，后收对端并合并）
pub async fn sync_connect(app: AppHandle, db_path: &str, addr: &str) -> Result<SyncStats, String> {
    let pool = open_pool(db_path).await?;
    let local = read_local_notes(&pool).await?;
    let sent = local.len();
    let attachments = collect_attachments(&app, &local);
    let pkg = SyncPackage { version: 1, notes: local, attachments, device_name: local_device_name(&app) };
    let bytes = serde_json::to_vec(&pkg).map_err(|e| e.to_string())?;

    // 手输地址，无预期指纹（用户主动信任）：仅验签不绑身份
    let mut stream = lan_connect_authed(&app, addr, None).await?;
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

/// 接收方：处理一个进来的同步连接（先握手认证，再收对端，后发本地，再合并）
async fn handle_conn(app: AppHandle, db_path: String, mut stream: TcpStream) -> Result<(), String> {
    // 认证握手：发 challenge → 验签 → 得到不可伪造的对端 fingerprint。
    // 10s 超时：未配对/慢速端不能迟迟不发签名而长期占用并发槽位（防 slowloris）。
    let (_remote_pk, remote_fp, challenge_i) =
        tokio::time::timeout(Duration::from_secs(10), lan_recv_handshake(&mut stream))
            .await
            .map_err(|_| "握手超时".to_string())??;
    if !crate::db::is_paired(&app, &remote_fp) {
        // 未配对：请求前端弹配对确认，本次拒绝合并
        let _ = app.emit(
            "sync:pairing-request",
            serde_json::json!({
                "fingerprint": remote_fp,
                "deviceName": "",
                "transport": "lan",
            }),
        );
        let _ = write_msg(&mut stream, b"PAIRING_REQUIRED").await;
        return Err(format!("对端 {} 未配对，已请求用户确认", remote_fp));
    }
    // 回证：对发起方下的 challenge 签名，让发起方也能验证本机身份在其白名单（双向认证）
    let secret = load_or_create_iroh_secret(&app)?;
    let resp = LanAuth {
        public_key: secret.public().to_string(),
        signature: secret.sign(&challenge_i).to_bytes().to_vec(),
        challenge: Vec::new(),
    };
    let resp_bytes = serde_json::to_vec(&resp).map_err(|e| e.to_string())?;
    write_msg(&mut stream, &resp_bytes).await?;

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
    // 接收方提示：让用户知道刚被对方推送了多少
    let _ = app.emit(
        "sync:received",
        serde_json::json!({
            "from": &remote.device_name,
            "received": remote.notes.len(),
            "inserted": inserted,
            "updated": updated,
            "conflicts": conflicts,
        }),
    );
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
        // 并发上限：最多同时处理 8 个入站同步连接，防恶意/故障端无限 spawn 耗尽资源
        let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(8));
        loop {
            match listener.accept().await {
                Ok((stream, peer)) => {
                    let permit = match sem.clone().try_acquire_owned() {
                        Ok(p) => p,
                        Err(_) => {
                            log::warn!("入站同步连接过多，拒绝来自 {} 的连接", peer);
                            drop(stream);
                            continue;
                        }
                    };
                    log::info!("收到同步连接: {}", peer);
                    let app2 = app.clone();
                    let db2 = db_path.clone();
                    tauri::async_runtime::spawn(async move {
                        let _permit = permit; // 持有到处理结束
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
    use std::net::Ipv4Addr;
    // VPN(如 sing-box TUN)、Docker、WSL 会抢占默认路由或建虚拟网卡，
    // 所以不能信 get_default_interface。改为枚举所有网卡，按"像家用局域网"打分：
    // 192.168.x 最优、10.x 次之、172.16~31.x（Docker/VPN 高发）垫底；非私有段忽略。
    let mut best: Option<(u8, Ipv4Addr)> = None;
    for iface in netdev::get_interfaces() {
        for net in iface.ipv4 {
            let ip = net.addr();
            if ip.is_loopback() || ip.is_link_local() {
                continue;
            }
            let o = ip.octets();
            let score: u8 = match (o[0], o[1]) {
                (192, 168) => 0,
                (10, _) => 1,
                (172, b) if (16..=31).contains(&b) => 3,
                _ => continue, // 非私有网段，不是局域网地址
            };
            if best.as_ref().map_or(true, |(s, _)| score < *s) {
                best = Some((score, ip));
            }
        }
    }
    best.map(|(_, ip)| ip.to_string())
        .unwrap_or_else(|| "127.0.0.1".to_string())
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

/// 读取或创建持久化的 iroh 身份密钥，保证设备 ID 重启后不变（存于 app_data_dir，与数据位置无关）
fn load_or_create_iroh_secret(app: &AppHandle) -> Result<iroh::SecretKey, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?;
    let key_path = dir.join("iroh_identity.key");
    if let Ok(bytes) = std::fs::read(&key_path) {
        if bytes.len() == 32 {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            return Ok(iroh::SecretKey::from_bytes(&arr));
        }
    }
    let key = iroh::SecretKey::generate();
    std::fs::create_dir_all(&dir).ok();
    std::fs::write(&key_path, key.to_bytes()).map_err(|e| format!("保存身份密钥失败: {}", e))?;
    Ok(key)
}

/// 获取或初始化全局 iroh Endpoint（幂等），并启动接收循环
async fn get_iroh_endpoint(app: AppHandle, db_path: String) -> Result<Endpoint, String> {
    let ep = IROH_EP
        .get_or_try_init(|| async {
            let secret = load_or_create_iroh_secret(&app)?;
            let ep = Endpoint::builder(presets::N0)
                .secret_key(secret)
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
    // 并发上限：最多同时处理 8 个跨网入站连接，防恶意/故障端无限连接耗尽资源
    let sem = std::sync::Arc::new(tokio::sync::Semaphore::new(8));
    loop {
        match ep.accept().await {
            Some(incoming) => {
                let permit = match sem.clone().try_acquire_owned() {
                    Ok(p) => p,
                    Err(_) => {
                        log::warn!("iroh 入站连接过多，拒绝新连接");
                        drop(incoming);
                        continue;
                    }
                };
                let app2 = app.clone();
                let db2 = db_path.clone();
                tauri::async_runtime::spawn(async move {
                    let _permit = permit; // 持有到处理结束
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
    // 认证前置：iroh 的 remote_id 是 TLS 已验证的对端公钥，不可伪造。
    // 取其前 16 字符作 fingerprint，连接一建立即判白名单——未配对者绝不读取/解析其负载。
    let remote_fp: String = conn.remote_id().to_string().chars().take(16).collect();
    let paired = crate::db::is_paired(&app, &remote_fp);
    let (mut send, mut recv) = conn.accept_bi().await.map_err(|e| e.to_string())?;

    if !paired {
        // 未配对：只允许读取至多 64 字节（仅够一个 PROBE），绝不读取/反序列化大同步包
        // （防对端可控 JSON 的解析放大 + 256MB 内存占用）
        let req = recv.read_to_end(64).await.unwrap_or_default();
        if req == b"PROBE" {
            // probe：返回本机设备名（支持「添加设备自动取名」，设备名属低危半公开信息）
            send.write_all(local_device_name(&app).as_bytes())
                .await
                .map_err(|e| e.to_string())?;
            send.finish().map_err(|e| e.to_string())?;
            conn.closed().await;
            return Ok(());
        }
        // 非 PROBE 且未配对 → 请求前端弹配对确认，拒绝合并
        let _ = app.emit(
            "sync:pairing-request",
            serde_json::json!({
                "fingerprint": remote_fp,
                "deviceName": "",
                "transport": "iroh",
            }),
        );
        let _ = send.write_all(b"PAIRING_REQUIRED").await;
        let _ = send.finish();
        conn.closed().await;
        return Err(format!("对端 {} 未配对，已请求用户确认", remote_fp));
    }

    // 已配对：可信对端，正常收包
    let req = recv
        .read_to_end(MAX_MSG as usize)
        .await
        .map_err(|e| e.to_string())?;
    // probe：对端只想确认连通并取回本机设备名，不传输笔记
    if req == b"PROBE" {
        send.write_all(local_device_name(&app).as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        send.finish().map_err(|e| e.to_string())?;
        conn.closed().await;
        return Ok(());
    }
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
    // 接收方提示：跨网推过来时同样告诉本机用户
    let _ = app.emit(
        "sync:received",
        serde_json::json!({
            "from": &remote.device_name,
            "received": remote.notes.len(),
            "inserted": inserted,
            "updated": updated,
            "conflicts": conflicts,
        }),
    );
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

/// 向对端 probe：验证连通性并取回对端的设备名（不传输笔记，用于"添加设备"）
pub async fn iroh_probe(app: AppHandle, db_path: &str, peer_id: &str) -> Result<String, String> {
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
    send.write_all(b"PROBE").await.map_err(|e| e.to_string())?;
    send.finish().map_err(|e| e.to_string())?;
    let resp = recv
        .read_to_end(MAX_MSG as usize)
        .await
        .map_err(|e| e.to_string())?;
    conn.close(0u8.into(), b"done");
    String::from_utf8(resp).map_err(|e| format!("解析对端设备名失败: {}", e))
}

/// 主动推送单条笔记给对端（仍走双向 sync 协议：发自己这一条 + 收对端的全部并 merge）
/// 用于"编辑器旁单条同步"——改完就推，不必等定时也不必传无关笔记
pub async fn iroh_push_note(
    app: AppHandle,
    db_path: &str,
    peer_id: &str,
    note_id: i64,
) -> Result<SyncStats, String> {
    let peer: EndpointId = peer_id
        .trim()
        .parse()
        .map_err(|e| format!("无效的设备 ID: {}", e))?;
    // 出站鉴权：只向已配对设备推送（peer_id 即 TLS 验证的公钥，前 16 字符为 fingerprint）
    let peer_fp: String = peer.to_string().chars().take(16).collect();
    if !crate::db::is_paired(&app, &peer_fp) {
        return Err("目标设备未在本机配对白名单，请先完成配对再同步".to_string());
    }
    let ep = get_iroh_endpoint(app.clone(), db_path.to_string()).await?;
    let conn = ep
        .connect(peer, IROH_ALPN)
        .await
        .map_err(|e| format!("连接对端失败: {}", e))?;
    let (mut send, mut recv) = conn.open_bi().await.map_err(|e| e.to_string())?;
    let pool = open_pool(db_path).await?;
    // 兜底补 uuid（同 read_local_notes 那道防线）
    sqlx::query("UPDATE notes SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL OR uuid = ''")
        .execute(&pool)
        .await
        .map_err(|e| format!("回填 uuid 失败: {}", e))?;
    // 只取这一条
    let local: Vec<SyncNote> = sqlx::query_as(
        "SELECT uuid,title,content,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled \
         FROM notes WHERE id = ? AND COALESCE(is_private, 0) = 0",
    )
    .bind(note_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("读取笔记失败: {}", e))?;
    if local.is_empty() {
        pool.close().await;
        return Err(format!("找不到 id={} 的笔记（或已标记为私有，不参与同步）", note_id));
    }
    let sent = local.len();
    let attachments = collect_attachments(&app, &local);
    let bytes = serde_json::to_vec(&SyncPackage {
        version: 1,
        notes: local,
        attachments,
        device_name: local_device_name(&app),
    })
    .map_err(|e| e.to_string())?;
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
    let (inserted, updated, conflicts) =
        merge_notes(&pool, &remote.notes, &remote.device_name).await?;
    pool.close().await;
    conn.close(0u8.into(), b"done");
    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(SyncStats {
        sent,
        received,
        inserted,
        updated,
        conflicts,
    })
}

/// 局域网多条推送：从选择列表勾选若干笔记，一次推给某地址
/// 与 lan_push_note 共用 TCP 帧 + merge 内核，区别仅 SELECT 的 IN 子句
pub async fn lan_push_notes(
    app: AppHandle,
    db_path: &str,
    addr: &str,
    note_ids: Vec<i64>,
    expected_fp: Option<&str>,
) -> Result<SyncStats, String> {
    if note_ids.is_empty() {
        return Err("未选择任何笔记".to_string());
    }
    let pool = open_pool(db_path).await?;
    sqlx::query("UPDATE notes SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL OR uuid = ''")
        .execute(&pool)
        .await
        .map_err(|e| format!("回填 uuid 失败: {}", e))?;

    // 动态 IN(?,?,...)
    let placeholders = note_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT uuid,title,content,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled \
         FROM notes WHERE id IN ({}) AND COALESCE(is_private, 0) = 0",
        placeholders
    );
    let mut q = sqlx::query_as::<_, SyncNote>(&sql);
    for id in &note_ids {
        q = q.bind(id);
    }
    let local: Vec<SyncNote> = q
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("读取笔记失败: {}", e))?;

    if local.is_empty() {
        pool.close().await;
        return Err("找不到选中的笔记".to_string());
    }
    let sent = local.len();
    let attachments = collect_attachments(&app, &local);
    let pkg = SyncPackage {
        version: 1,
        notes: local,
        attachments,
        device_name: local_device_name(&app),
    };
    let bytes = serde_json::to_vec(&pkg).map_err(|e| e.to_string())?;

    // 来自 mDNS 发现并已配对的设备会带预期指纹，校验应答方身份一致防 ARP 冒名
    let mut stream = lan_connect_authed(&app, addr, expected_fp).await?;
    write_msg(&mut stream, &bytes).await?;
    let resp = read_msg(&mut stream).await?;
    let remote: SyncPackage =
        serde_json::from_slice(&resp).map_err(|e| format!("解析对端数据失败: {}", e))?;
    save_attachments(&app, &remote.attachments);
    let received = remote.notes.len();
    let (inserted, updated, conflicts) =
        merge_notes(&pool, &remote.notes, &remote.device_name).await?;
    pool.close().await;

    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(SyncStats {
        sent,
        received,
        inserted,
        updated,
        conflicts,
    })
}

// ==================== 局域网设备发现（mDNS / DNS-SD）====================
const MDNS_SERVICE: &str = "_jdnotes._tcp.local.";
static MDNS_DAEMON: OnceCell<mdns_sd::ServiceDaemon> = OnceCell::const_new();

#[derive(serde::Serialize, Clone)]
pub struct DiscoveredDevice {
    pub address: String,
    pub device_name: String,
    /// 持久设备指纹：公钥派生（base32 前 16 字符，约 80 bits 熵），重启稳定不变
    /// 与跨网设备 ID（完整 PublicKey）同一身份源——一份身份两种传输共用
    pub fingerprint: String,
    /// 协议版本（TXT proto 字段），不兼容时前端可灰显
    pub protocol: String,
}

/// 本机 fingerprint 缓存，lan_discover 用来过滤"自己发现自己"
static LOCAL_FINGERPRINT: OnceCell<String> = OnceCell::const_new();

/// 首次调用时启动 mDNS daemon 并注册本机服务（之后复用，幂等）
async fn ensure_mdns_started(app: &AppHandle) -> Result<&'static mdns_sd::ServiceDaemon, String> {
    MDNS_DAEMON
        .get_or_try_init(|| async {
            let daemon = mdns_sd::ServiceDaemon::new()
                .map_err(|e| format!("mDNS daemon 启动失败: {}", e))?;
            let local = local_ip();
            let device = local_device_name(app);
            // 持久 fingerprint：复用 iroh SecretKey 派生（base32 前 16 字符）
            // 重启稳定 + 不暴露私钥；UI 上局域网设备能跟跨网设备认成同一台
            let secret = load_or_create_iroh_secret(app)
                .map_err(|e| format!("读取设备身份失败: {}", e))?;
            let fingerprint: String = secret.public().to_string().chars().take(16).collect();
            let _ = LOCAL_FINGERPRINT.set(fingerprint.clone());
            // 实例名也用 fingerprint，不再每次随机——重启同台机在对方眼里就是同一设备
            let instance = format!("jdnotes-{}", fingerprint);
            let host_name = format!("{}.local.", instance);
            let mut txt = std::collections::HashMap::new();
            txt.insert("device".to_string(), device);
            txt.insert("fp".to_string(), fingerprint.clone());
            txt.insert("proto".to_string(), "1".to_string());
            let info = mdns_sd::ServiceInfo::new(
                MDNS_SERVICE,
                &instance,
                &host_name,
                local.as_str(),
                SYNC_PORT,
                txt,
            )
            .map_err(|e| format!("构造 mDNS 服务信息失败: {}", e))?;
            daemon
                .register(info)
                .map_err(|e| format!("mDNS 注册失败: {}", e))?;
            log::info!(
                "mDNS 服务已注册: {} @ {}:{} (fp={}, proto=1)",
                MDNS_SERVICE,
                local,
                SYNC_PORT,
                fingerprint
            );
            Ok::<mdns_sd::ServiceDaemon, String>(daemon)
        })
        .await
}

/// 浏览同网段的 jdnotes 服务，约 1.5s 后返回发现的设备列表
pub async fn lan_discover(app: AppHandle) -> Result<Vec<DiscoveredDevice>, String> {
    let daemon = ensure_mdns_started(&app).await?.clone();
    tokio::task::spawn_blocking(move || -> Result<Vec<DiscoveredDevice>, String> {
        let receiver = daemon
            .browse(MDNS_SERVICE)
            .map_err(|e| format!("mDNS 浏览失败: {}", e))?;
        let mut devices: Vec<DiscoveredDevice> = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(1500);
        loop {
            let Some(remaining) = deadline.checked_duration_since(std::time::Instant::now())
            else {
                break;
            };
            match receiver.recv_timeout(remaining) {
                Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) => {
                    let port = info.get_port();
                    let device = info
                        .get_property_val_str("device")
                        .unwrap_or("")
                        .to_string();
                    let fp = info
                        .get_property_val_str("fp")
                        .unwrap_or("")
                        .to_string();
                    let proto = info
                        .get_property_val_str("proto")
                        .unwrap_or("1")
                        .to_string();
                    // 过滤"自己发现自己"：fingerprint 一致即跳过
                    if !fp.is_empty()
                        && LOCAL_FINGERPRINT.get().map(|s| s.as_str()) == Some(fp.as_str())
                    {
                        continue;
                    }
                    if !fp.is_empty() {
                        // fp 非空：一台机只列一条（按 fp 去重），多网卡取第一个 IP
                        if seen.insert(fp.clone()) {
                            if let Some(ip) = info.get_addresses_v4().into_iter().next() {
                                devices.push(DiscoveredDevice {
                                    address: format!("{}:{}", ip, port),
                                    device_name: device.clone(),
                                    fingerprint: fp.clone(),
                                    protocol: proto.clone(),
                                });
                            }
                        }
                    } else {
                        // fp 空（对端老版本无 TXT.fp）：兼容路径，每个 IP 各列一条
                        for ip in info.get_addresses_v4() {
                            let addr = format!("{}:{}", ip, port);
                            if seen.insert(addr.clone()) {
                                devices.push(DiscoveredDevice {
                                    address: addr,
                                    device_name: device.clone(),
                                    fingerprint: fp.clone(),
                                    protocol: proto.clone(),
                                });
                            }
                        }
                    }
                }
                Ok(_) => continue,
                Err(_) => break,
            }
        }
        let _ = daemon.stop_browse(MDNS_SERVICE);
        Ok(devices)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 重新注册 mDNS 服务（用户改设备名后调，使对方能立即看到新名字）
/// 实例名 = `jdnotes-<fp>` 一直不变，只换 TXT 里的 device。
pub async fn mdns_reregister_device_name(app: &AppHandle) -> Result<(), String> {
    let Some(daemon) = MDNS_DAEMON.get() else {
        // mDNS 还没启动，首次启动时会自然用上最新 device_name，啥也不用做
        return Ok(());
    };
    let Some(fingerprint) = LOCAL_FINGERPRINT.get().cloned() else {
        return Ok(());
    };
    let local = local_ip();
    let device = local_device_name(app);
    let instance = format!("jdnotes-{}", fingerprint);
    let fullname = format!("{}.{}", instance, MDNS_SERVICE);
    let host_name = format!("{}.local.", instance);
    // 撤销旧的（同 fullname 直接 register 不会换 TXT，必须先 unregister）
    let _ = daemon.unregister(&fullname);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    let mut txt = std::collections::HashMap::new();
    txt.insert("device".to_string(), device);
    txt.insert("fp".to_string(), fingerprint);
    txt.insert("proto".to_string(), "1".to_string());
    let info = mdns_sd::ServiceInfo::new(
        MDNS_SERVICE,
        &instance,
        &host_name,
        local.as_str(),
        SYNC_PORT,
        txt,
    )
    .map_err(|e| format!("构造 mDNS 服务信息失败: {}", e))?;
    daemon
        .register(info)
        .map_err(|e| format!("mDNS 重注册失败: {}", e))?;
    log::info!("mDNS 已重注册（设备名变更）");
    Ok(())
}

/// 应用启动入口：拉起 TCP 监听 + mDNS 注册（让用户即使没打开同步页也能被对方发现）
pub async fn init_lan_sync(app: AppHandle, db_path: String) {
    start_listener(app.clone(), db_path);
    if let Err(e) = ensure_mdns_started(&app).await {
        log::warn!("mDNS 启动失败，局域网自动发现不可用: {}", e);
    }
}

/// 应用退出前调用：发送 mDNS goodbye 包，对端列表立即清除本机
/// 不调的话对方要等几分钟 TTL 才看到我们离线，体验略差
pub fn shutdown_mdns() {
    if let Some(daemon) = MDNS_DAEMON.get() {
        // shutdown 非阻塞，返回的 Receiver 我们不等——goodbye 包发出即可
        let _ = daemon.shutdown();
        log::info!("mDNS 已 shutdown（goodbye 包发送中）");
    }
}

/// 局域网版的单条推送：TCP 直连对方地址，只发指定那一条笔记（仍双向：本机也收对端的并 merge）
pub async fn lan_push_note(
    app: AppHandle,
    db_path: &str,
    addr: &str,
    note_id: i64,
    expected_fp: Option<&str>,
) -> Result<SyncStats, String> {
    let pool = open_pool(db_path).await?;
    sqlx::query("UPDATE notes SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL OR uuid = ''")
        .execute(&pool)
        .await
        .map_err(|e| format!("回填 uuid 失败: {}", e))?;
    let local: Vec<SyncNote> = sqlx::query_as(
        "SELECT uuid,title,content,tags,is_favorite,is_deleted,created_at,updated_at,reminder_date,reminder_enabled \
         FROM notes WHERE id = ? AND COALESCE(is_private, 0) = 0",
    )
    .bind(note_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("读取笔记失败: {}", e))?;
    if local.is_empty() {
        pool.close().await;
        return Err(format!("找不到 id={} 的笔记（或已标记为私有，不参与同步）", note_id));
    }
    let sent = local.len();
    let attachments = collect_attachments(&app, &local);
    let pkg = SyncPackage {
        version: 1,
        notes: local,
        attachments,
        device_name: local_device_name(&app),
    };
    let bytes = serde_json::to_vec(&pkg).map_err(|e| e.to_string())?;

    // mDNS 发现的设备带预期指纹（校验应答方身份防 ARP 冒名）；手输地址为 None（仅验签不绑身份）
    let mut stream = lan_connect_authed(&app, addr, expected_fp).await?;
    write_msg(&mut stream, &bytes).await?;
    let resp = read_msg(&mut stream).await?;
    let remote: SyncPackage =
        serde_json::from_slice(&resp).map_err(|e| format!("解析对端数据失败: {}", e))?;
    save_attachments(&app, &remote.attachments);
    let received = remote.notes.len();
    let (inserted, updated, conflicts) =
        merge_notes(&pool, &remote.notes, &remote.device_name).await?;
    pool.close().await;

    if inserted > 0 || updated > 0 || conflicts > 0 {
        let _ = app.emit("db:changed", ());
    }
    Ok(SyncStats {
        sent,
        received,
        inserted,
        updated,
        conflicts,
    })
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
    // 出站鉴权：只向已配对设备发起同步（peer_id 即 TLS 验证的公钥，前 16 字符为 fingerprint）
    let peer_fp: String = peer.to_string().chars().take(16).collect();
    if !crate::db::is_paired(&app, &peer_fp) {
        return Err("目标设备未在本机配对白名单，请先完成配对再同步".to_string());
    }
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
