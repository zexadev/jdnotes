use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FILE: &str = "config.json";

/// AI 提供商类型
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq)]
pub enum AIProvider {
    /// OpenAI 兼容格式（包括 OpenAI、DeepSeek、智谱AI、通义千问、Moonshot 等）
    #[default]
    OpenAICompatible,
    /// Anthropic Claude
    Anthropic,
    /// Google Gemini
    Google,
    /// Ollama 本地模型
    Ollama,
}

/// AI 设置结构
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AISettings {
    /// AI 提供商
    #[serde(default)]
    pub provider: AIProvider,
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
            provider: AIProvider::OpenAICompatible,
            base_url: "https://api.deepseek.com/v1".to_string(),
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

        // 尝试解析配置文件
        match serde_json::from_str::<AppConfig>(&content) {
            Ok(config) => {
                log::info!("配置加载成功，database_path: {:?}", config.database_path);
                Ok(config)
            },
            Err(e) => {
                log::warn!("配置文件解析失败，尝试迁移旧配置: {}", e);

                // 尝试解析旧配置格式（可能只有 database_path 和旧的 ai_settings）
                if let Ok(old_config) = serde_json::from_str::<serde_json::Value>(&content) {
                    let mut new_config = AppConfig::default();

                    // 迁移 database_path - 同时处理字符串和 null 值
                    if let Some(db_path_value) = old_config.get("database_path") {
                        if let Some(db_path) = db_path_value.as_str() {
                            // 值是有效的字符串
                            if !db_path.is_empty() {
                                log::info!("迁移 database_path: {}", db_path);
                                new_config.database_path = Some(db_path.to_string());
                            }
                        }
                        // 如果是 null，保持 database_path 为 None（使用默认路径）
                    }

                    // 迁移旧的 ai_settings
                    if let Some(ai_settings) = old_config.get("ai_settings") {
                        if let Some(base_url) = ai_settings.get("base_url").and_then(|v| v.as_str()) {
                            // 如果旧的 base_url 不包含版本号，添加 /v1
                            new_config.ai_settings.base_url = if base_url.ends_with("/v1") || base_url.contains("/v4") {
                                base_url.to_string()
                            } else {
                                format!("{}/v1", base_url.trim_end_matches('/'))
                            };
                        }
                        if let Some(api_key) = ai_settings.get("api_key").and_then(|v| v.as_str()) {
                            new_config.ai_settings.api_key = api_key.to_string();
                        }
                        if let Some(model) = ai_settings.get("model").and_then(|v| v.as_str()) {
                            new_config.ai_settings.model = model.to_string();
                        }
                        // 迁移 provider 字段
                        if let Some(provider) = ai_settings.get("provider").and_then(|v| v.as_str()) {
                            new_config.ai_settings.provider = match provider {
                                "Anthropic" => AIProvider::Anthropic,
                                "Google" => AIProvider::Google,
                                "Ollama" => AIProvider::Ollama,
                                _ => AIProvider::OpenAICompatible,
                            };
                        }
                    }

                    // 保存迁移后的配置
                    if let Err(save_err) = save_config_internal(&config_path, &new_config) {
                        log::warn!("保存迁移后的配置失败: {}", save_err);
                    } else {
                        log::info!("配置迁移成功，database_path: {:?}", new_config.database_path);
                    }

                    Ok(new_config)
                } else {
                    // 无法解析，尝试从备份恢复
                    log::error!("配置文件完全无法解析");
                    let backup_path = config_path.with_extension("json.backup");
                    let mut recovered_db_path: Option<String> = None;

                    // 尝试从备份文件恢复 database_path
                    if backup_path.exists() {
                        log::info!("尝试从备份文件恢复配置: {:?}", backup_path);
                        if let Ok(backup_content) = fs::read_to_string(&backup_path) {
                            if let Ok(backup_value) = serde_json::from_str::<serde_json::Value>(&backup_content) {
                                if let Some(db_path) = backup_value.get("database_path").and_then(|v| v.as_str()) {
                                    if !db_path.is_empty() {
                                        log::info!("从备份恢复 database_path: {}", db_path);
                                        recovered_db_path = Some(db_path.to_string());
                                    }
                                }
                            }
                        }
                    }

                    // 备份当前损坏的配置文件（如果还没有备份）
                    if !backup_path.exists() {
                        if let Err(backup_err) = fs::copy(&config_path, &backup_path) {
                            log::warn!("备份旧配置文件失败: {}", backup_err);
                        } else {
                            log::info!("旧配置文件已备份到: {:?}", backup_path);
                        }
                    }

                    // 创建新配置，保留恢复的 database_path
                    let mut new_config = AppConfig::default();
                    new_config.database_path = recovered_db_path;

                    if let Err(save_err) = save_config_internal(&config_path, &new_config) {
                        log::warn!("保存配置失败: {}", save_err);
                    } else {
                        log::info!("配置已重建，database_path: {:?}", new_config.database_path);
                    }

                    Ok(new_config)
                }
            }
        }
    } else {
        log::info!("配置文件不存在，使用默认配置");
        Ok(AppConfig::default())
    }
}

/// 内部保存配置函数（不依赖 AppHandle）
fn save_config_internal(config_path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(config_path, content)
        .map_err(|e| format!("保存配置文件失败: {}", e))?;
    Ok(())
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

    if let Some(custom_path) = &config.database_path {
        let path = PathBuf::from(custom_path);

        // 验证自定义路径
        if let Some(parent) = path.parent() {
            if parent.exists() {
                // 目录存在，使用自定义路径
                log::info!("使用自定义数据库路径: {:?}", path);
                return Ok(path);
            } else {
                // 目录不存在，尝试创建
                log::warn!("自定义数据库目录不存在，尝试创建: {:?}", parent);
                match fs::create_dir_all(parent) {
                    Ok(_) => {
                        log::info!("成功创建数据库目录: {:?}", parent);
                        return Ok(path);
                    }
                    Err(e) => {
                        // 无法创建目录，回退到默认路径但不修改配置
                        // 这样用户下次可以修复目录问题
                        log::error!("无法创建自定义数据库目录: {}，回退到默认路径", e);
                    }
                }
            }
        }
    }

    // 使用默认路径
    let default_path = get_default_database_path(app)?;
    log::info!("使用默认数据库路径: {:?}", default_path);
    Ok(default_path)
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
/// 1. 备份当前配置
/// 2. 将当前数据库复制到新位置
/// 3. 更新配置（下次启动时使用新位置）
pub fn change_database_location(app: &tauri::AppHandle, new_dir: &str) -> Result<String, String> {
    let current_path = get_database_path(app)?;
    let new_path = PathBuf::from(new_dir).join("jdnotes.db");

    log::info!("当前数据库路径: {:?}", current_path);
    log::info!("新数据库路径: {:?}", new_path);

    // 先备份当前配置（在做任何更改之前）
    let config_path = get_config_path(app)?;
    let config_backup_path = config_path.with_extension("json.backup");
    if config_path.exists() {
        fs::copy(&config_path, &config_backup_path)
            .map_err(|e| format!("备份配置文件失败: {}", e))?;
        log::info!("配置文件已备份到: {:?}", config_backup_path);
    }

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

    log::info!("配置已更新，新数据库路径: {}", new_path.to_string_lossy());

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
