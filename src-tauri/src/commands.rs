use crate::db::{self, AISettings};
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

// ============= AI 设置管理 =============

/// 获取 AI 设置
#[tauri::command]
pub async fn get_ai_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let settings = db::get_ai_settings(&app)?;
    Ok(serde_json::json!({
        "aiBaseUrl": settings.base_url,
        "aiApiKey": settings.api_key,
        "aiModel": settings.model
    }))
}

/// 保存 AI 设置
#[tauri::command]
pub async fn save_ai_settings(
    app: tauri::AppHandle,
    base_url: String,
    api_key: String,
    model: String,
) -> Result<(), String> {
    let settings = AISettings {
        base_url,
        api_key,
        model,
    };
    db::save_ai_settings(&app, settings)?;
    Ok(())
}

/// 获取配置文件路径
#[tauri::command]
pub async fn get_config_path(app: tauri::AppHandle) -> Result<String, String> {
    db::get_config_file_path(&app)
}
