use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FILE: &str = "config.json";

/// AI 设置结构
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AISettings {
    /// AI API 基础 URL
    pub base_url: String,
    /// AI API Key
    pub api_key: String,
    /// AI 模型名称
    pub model: String,
}

impl Default for AISettings {
    fn default() -> Self {
        Self {
            base_url: "https://api.deepseek.com".to_string(),
            api_key: String::new(),
            model: "deepseek-chat".to_string(),
        }
    }
}

/// 配置结构
#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct AppConfig {
    /// 用户自定义的数据库路径（如果为 None 则使用默认路径）
    pub database_path: Option<String>,
    /// AI 设置
    #[serde(default)]
    pub ai_settings: AISettings,
}

/// 获取配置文件路径
fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("创建应用数据目录失败: {}", e))?;
    }

    Ok(app_data_dir.join(CONFIG_FILE))
}

/// 读取配置
pub fn load_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let config_path = get_config_path(app)?;
    
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置文件失败: {}", e))
    } else {
        Ok(AppConfig::default())
    }
}

/// 保存配置
pub fn save_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_path(app)?;
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("保存配置文件失败: {}", e))?;
    Ok(())
}

/// 获取默认数据库路径
pub fn get_default_database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    // 确保目录存在
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("创建应用数据目录失败: {}", e))?;
    }

    Ok(app_data_dir.join("jdnotes.db"))
}

/// 获取实际使用的数据库路径（考虑用户配置）
pub fn get_database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config = load_config(app)?;
    
    if let Some(custom_path) = config.database_path {
        let path = PathBuf::from(&custom_path);
        // 确保目录存在
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("创建数据库目录失败: {}", e))?;
            }
        }
        Ok(path)
    } else {
        get_default_database_path(app)
    }
}

/// 获取数据库连接 URL
pub fn get_database_url(app: &tauri::AppHandle) -> Result<String, String> {
    let db_path = get_database_path(app)?;
    Ok(format!("sqlite:{}", db_path.to_string_lossy()))
}

/// 检查数据库文件是否存在
pub fn database_exists(app: &tauri::AppHandle) -> Result<bool, String> {
    let db_path = get_database_path(app)?;
    Ok(db_path.exists())
}

/// 获取数据库文件大小（字节）
pub fn get_database_size(app: &tauri::AppHandle) -> Result<u64, String> {
    let db_path = get_database_path(app)?;
    if db_path.exists() {
        let metadata = fs::metadata(&db_path)
            .map_err(|e| format!("获取数据库文件信息失败: {}", e))?;
        Ok(metadata.len())
    } else {
        Ok(0)
    }
}

/// 更改数据库存储位置
/// 1. 将当前数据库复制到新位置
/// 2. 更新配置（下次启动时使用新位置）
pub fn change_database_location(app: &tauri::AppHandle, new_dir: &str) -> Result<String, String> {
    let current_path = get_database_path(app)?;
    let new_path = PathBuf::from(new_dir).join("jdnotes.db");
    
    log::info!("当前数据库路径: {:?}", current_path);
    log::info!("新数据库路径: {:?}", new_path);
    
    // 确保新目录存在
    if let Some(parent) = new_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建目标目录失败: {}", e))?;
        }
    }
    
    // 如果当前数据库存在，复制到新位置
    if current_path.exists() {
        // 如果目标位置已存在同名文件，先备份
        if new_path.exists() {
            let backup_path = new_path.with_extension("db.backup");
            log::info!("目标位置已存在文件，备份到: {:?}", backup_path);
            fs::copy(&new_path, &backup_path)
                .map_err(|e| format!("备份目标位置已存在的文件失败: {}", e))?;
        }
        
        // 复制数据库文件到新位置
        log::info!("复制数据库文件...");
        fs::copy(&current_path, &new_path)
            .map_err(|e| format!("复制数据库文件失败: {}", e))?;
        
        log::info!("数据库复制成功");
    }
    
    // 更新配置
    let mut config = load_config(app)?;
    config.database_path = Some(new_path.to_string_lossy().to_string());
    save_config(app, &config)?;
    
    log::info!("配置已更新，下次启动将使用新位置");
    
    Ok(new_path.to_string_lossy().to_string())
}

/// 复制数据库文件到新位置（仅复制，不更改配置）
pub fn copy_database(app: &tauri::AppHandle, new_path: &str) -> Result<(), String> {
    let current_path = get_database_path(app)?;
    
    if !current_path.exists() {
        return Err("当前数据库文件不存在".to_string());
    }
    
    fs::copy(&current_path, new_path)
        .map_err(|e| format!("复制数据库文件失败: {}", e))?;
    
    Ok(())
}

/// 获取初始化 SQL
pub fn get_init_sql() -> &'static str {
    include_str!("../migrations/001_initial.sql")
}

// ============= AI 设置管理 =============

/// 获取 AI 设置
pub fn get_ai_settings(app: &tauri::AppHandle) -> Result<AISettings, String> {
    let config = load_config(app)?;
    Ok(config.ai_settings)
}

/// 保存 AI 设置
pub fn save_ai_settings(app: &tauri::AppHandle, settings: AISettings) -> Result<(), String> {
    let mut config = load_config(app)?;
    config.ai_settings = settings;
    save_config(app, &config)?;
    Ok(())
}

/// 获取配置文件路径（供外部调用）
pub fn get_config_file_path(app: &tauri::AppHandle) -> Result<String, String> {
    let config_path = get_config_path(app)?;
    Ok(config_path.to_string_lossy().to_string())
}
