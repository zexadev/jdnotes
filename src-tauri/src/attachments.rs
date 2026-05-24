//! 图片附件：内容寻址存储
//!
//! 图片存为 app_data_dir/attachments/<sha256>.<ext> 独立文件，正文只存 `attachment://<hash>` 短引用。
//! 内容寻址 = 文件名即内容 sha256，天然去重；附件不可变，永不冲突。
//! 固定在 app_data_dir/attachments（不随自定义 db 路径变），便于 asset 协议 scope 固定。

use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// 附件目录（不存在则创建）
pub fn attachments_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {}", e))?
        .join("attachments");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建附件目录失败: {}", e))?;
    }
    Ok(dir)
}

/// 计算内容 sha256（hex）
pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

/// 保存附件字节，按内容寻址去重，返回 hash
pub fn save_bytes(app: &tauri::AppHandle, bytes: &[u8], ext: &str) -> Result<String, String> {
    let hash = sha256_hex(bytes);
    let dir = attachments_dir(app)?;
    let ext = if ext.is_empty() { "png" } else { ext };
    let path = dir.join(format!("{}.{}", hash, ext));
    if !path.exists() {
        fs::write(&path, bytes).map_err(|e| format!("写入附件失败: {}", e))?;
    }
    Ok(hash)
}

/// 按 hash 查附件文件绝对路径（任意扩展名）
pub fn find_path(app: &tauri::AppHandle, hash: &str) -> Result<Option<PathBuf>, String> {
    let dir = attachments_dir(app)?;
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.file_stem().and_then(|s| s.to_str()) == Some(hash) {
                return Ok(Some(p));
            }
        }
    }
    Ok(None)
}

/// 读取附件字节（供导出 / 同步打包）
#[allow(dead_code)]
pub fn read_bytes(app: &tauri::AppHandle, hash: &str) -> Result<Option<Vec<u8>>, String> {
    match find_path(app, hash)? {
        Some(p) => Ok(Some(fs::read(&p).map_err(|e| format!("读取附件失败: {}", e))?)),
        None => Ok(None),
    }
}

/// 取附件扩展名
#[allow(dead_code)]
pub fn find_ext(app: &tauri::AppHandle, hash: &str) -> Result<Option<String>, String> {
    Ok(find_path(app, hash)?
        .and_then(|p| p.extension().and_then(|e| e.to_str()).map(|s| s.to_string())))
}
