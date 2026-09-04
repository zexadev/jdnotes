use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use uuid::Uuid;

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
    /// OpenAI Responses API（Azure AI Foundry 等）
    Responses,
}

/// 单个 AI 来源配置
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AISource {
    pub id: String,
    pub name: String,
    pub provider: AIProvider,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    /// 上下文窗口（tokens）。None = 前端按模型名推断内置真实值
    #[serde(default)]
    pub context_window: Option<u32>,
}

impl Default for AISource {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: "DeepSeek".to_string(),
            provider: AIProvider::OpenAICompatible,
            base_url: "https://api.deepseek.com/v1".to_string(),
            api_key: String::new(),
            model: "deepseek-chat".to_string(),
            context_window: None,
        }
    }
}

/// 配置结构
#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct AppConfig {
    /// 用户自定义的数据库路径（如果为 None 则使用默认路径）
    pub database_path: Option<String>,
    /// AI 来源列表
    #[serde(default = "default_ai_sources")]
    pub ai_sources: Vec<AISource>,
    /// 当前激活的来源 ID
    #[serde(default)]
    pub active_source_id: String,
    /// 本设备名称（同步时随包发送，用于在对端的冲突副本里标注来源）
    #[serde(default)]
    pub device_name: String,
    /// 已配对设备的指纹白名单（fingerprint = 公钥前 16 字符）
    /// 接收端在合并前校验对端 fp 在册才放行；这是后端权威白名单，前端 localStorage 仅做 UI 展示
    #[serde(default)]
    pub paired_fingerprints: Vec<String>,
    /// 「我的设备」指纹（paired 的子集）。只有在此名单内的设备才允许全量双向同步：
    /// 出站发起全量同步、入站回灌整库都要求 is_mine 为真。不在此名单的已配对设备 = 分享对象（仅单向选发）。
    /// 后端权威，杜绝前端篡改把分享对象升格成全量同步。
    #[serde(default)]
    pub mine_fingerprints: Vec<String>,
    /// 联网搜索 API 配置。填了 key 就走专业 API（结果远优于抓取），留空回退抓取 Bing/DDG。
    #[serde(default)]
    pub search_api: SearchApiConfig,
}

/// 单个搜索 API 提供商配置
#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
pub struct SearchProviderEntry {
    /// 提供商："tavily" | "brave" | "serper" | "jina"
    pub provider: String,
    /// API Key
    #[serde(default)]
    pub api_key: String,
    /// 是否启用（关掉后轮换时跳过，但保留 Key）
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// 联网搜索 API 配置：多提供商轮换，摊开各家免费额度
#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
pub struct SearchApiConfig {
    /// 旧版单提供商字段（仅用于向后兼容迁移，新代码读 providers）
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub api_key: String,
    /// 提供商列表，按轮换顺序使用
    #[serde(default)]
    pub providers: Vec<SearchProviderEntry>,
}

impl SearchApiConfig {
    /// 归一化：把旧版单字段迁移进 providers 列表，返回启用且有 key 的提供商
    pub fn active_providers(&self) -> Vec<SearchProviderEntry> {
        let mut list = self.providers.clone();
        // 兼容旧配置：只有单字段没有列表时，迁移进来
        if list.is_empty() && !self.provider.is_empty() && !self.api_key.is_empty() {
            list.push(SearchProviderEntry {
                provider: self.provider.clone(),
                api_key: self.api_key.clone(),
                enabled: true,
            });
        }
        list.into_iter()
            .filter(|p| p.enabled && !p.api_key.trim().is_empty() && !p.provider.is_empty())
            .collect()
    }
}

fn default_ai_sources() -> Vec<AISource> {
    vec![AISource::default()]
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

/// 从旧 ai_settings 格式迁移到新 ai_sources 格式
fn migrate_ai_settings_to_sources(old_config: &serde_json::Value) -> (Vec<AISource>, String) {
    let mut source = AISource::default();

    if let Some(ai_settings) = old_config.get("ai_settings") {
        if let Some(base_url) = ai_settings.get("base_url").and_then(|v| v.as_str()) {
            source.base_url = if base_url.ends_with("/v1") || base_url.contains("/v4") {
                base_url.to_string()
            } else {
                format!("{}/v1", base_url.trim_end_matches('/'))
            };
        }
        if let Some(api_key) = ai_settings.get("api_key").and_then(|v| v.as_str()) {
            source.api_key = api_key.to_string();
        }
        if let Some(model) = ai_settings.get("model").and_then(|v| v.as_str()) {
            source.model = model.to_string();
        }
        if let Some(provider) = ai_settings.get("provider").and_then(|v| v.as_str()) {
            source.provider = match provider {
                "Anthropic" => AIProvider::Anthropic,
                "Google" => AIProvider::Google,
                "Ollama" => AIProvider::Ollama,
                _ => AIProvider::OpenAICompatible,
            };
        }
        // 根据 provider/url 推断名称
        source.name = match &source.provider {
            AIProvider::Anthropic => "Claude".to_string(),
            AIProvider::Google => "Gemini".to_string(),
            AIProvider::Ollama => "Ollama".to_string(),
            AIProvider::Responses => "Responses API".to_string(),
            AIProvider::OpenAICompatible => {
                if source.base_url.contains("deepseek") {
                    "DeepSeek".to_string()
                } else if source.base_url.contains("openai") {
                    "OpenAI".to_string()
                } else {
                    "AI 来源".to_string()
                }
            }
        };
    }

    let active_id = source.id.clone();
    (vec![source], active_id)
}

/// 读取配置
pub fn load_config(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let config_path = get_config_path(app)?;

    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;

        // 先尝试解析为 JSON Value 来检测格式
        if let Ok(raw_value) = serde_json::from_str::<serde_json::Value>(&content) {
            // 检测是否为旧格式（有 ai_settings 但没有 ai_sources）
            let needs_migration = raw_value.get("ai_settings").is_some()
                && raw_value.get("ai_sources").is_none();

            if needs_migration {
                log::info!("检测到旧配置格式，执行迁移...");
                let mut new_config = AppConfig::default();

                // 迁移 database_path
                if let Some(db_path_value) = raw_value.get("database_path") {
                    if let Some(db_path) = db_path_value.as_str() {
                        if !db_path.is_empty() {
                            new_config.database_path = Some(db_path.to_string());
                        }
                    }
                }

                // 迁移 ai_settings -> ai_sources
                let (sources, active_id) = migrate_ai_settings_to_sources(&raw_value);
                new_config.ai_sources = sources;
                new_config.active_source_id = active_id;

                // 保存迁移后的配置
                if let Err(save_err) = save_config_internal(&config_path, &new_config) {
                    log::warn!("保存迁移后的配置失败: {}", save_err);
                } else {
                    log::info!("配置迁移成功");
                }

                return Ok(new_config);
            }
        }

        // 尝试直接解析新格式
        match serde_json::from_str::<AppConfig>(&content) {
            Ok(mut config) => {
                // 确保至少有一个来源
                if config.ai_sources.is_empty() {
                    config.ai_sources = default_ai_sources();
                    config.active_source_id = config.ai_sources[0].id.clone();
                }
                // 确保 active_source_id 有效
                if !config.ai_sources.iter().any(|s| s.id == config.active_source_id) {
                    config.active_source_id = config.ai_sources[0].id.clone();
                }
                log::debug!("配置加载成功，database_path: {:?}", config.database_path);
                Ok(config)
            },
            Err(e) => {
                log::warn!("配置文件解析失败: {}", e);

                let backup_path = config_path.with_extension("json.backup");
                let mut recovered_db_path: Option<String> = None;

                if backup_path.exists() {
                    if let Ok(backup_content) = fs::read_to_string(&backup_path) {
                        if let Ok(backup_value) = serde_json::from_str::<serde_json::Value>(&backup_content) {
                            if let Some(db_path) = backup_value.get("database_path").and_then(|v| v.as_str()) {
                                if !db_path.is_empty() {
                                    recovered_db_path = Some(db_path.to_string());
                                }
                            }
                        }
                    }
                }

                if !backup_path.exists() {
                    let _ = fs::copy(&config_path, &backup_path);
                }

                let mut new_config = AppConfig::default();
                new_config.database_path = recovered_db_path;

                let _ = save_config_internal(&config_path, &new_config);
                Ok(new_config)
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
                log::debug!("使用自定义数据库路径: {:?}", path);
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

// ============= AI 配置管理 =============

/// 获取 AI 配置（所有来源 + 激活 ID）
pub fn get_ai_config(app: &tauri::AppHandle) -> Result<(Vec<AISource>, String), String> {
    let config = load_config(app)?;
    Ok((config.ai_sources, config.active_source_id))
}

/// 保存 AI 配置（所有来源 + 激活 ID）
pub fn save_ai_config(app: &tauri::AppHandle, sources: Vec<AISource>, active_source_id: String) -> Result<(), String> {
    let mut config = load_config(app)?;
    config.ai_sources = sources;
    config.active_source_id = active_source_id;
    save_config(app, &config)?;
    Ok(())
}

/// 获取配置文件路径（供外部调用）
pub fn get_config_file_path(app: &tauri::AppHandle) -> Result<String, String> {
    let config_path = get_config_path(app)?;
    Ok(config_path.to_string_lossy().to_string())
}

/// 获取联网搜索 API 配置
pub fn get_search_api(app: &tauri::AppHandle) -> Result<SearchApiConfig, String> {
    Ok(load_config(app)?.search_api)
}

/// 保存联网搜索 API 提供商列表
pub fn set_search_api(app: &tauri::AppHandle, providers: Vec<SearchProviderEntry>) -> Result<(), String> {
    let mut config = load_config(app)?;
    // 写入新列表，清掉旧版单字段避免迁移逻辑重复叠加
    config.search_api = SearchApiConfig {
        provider: String::new(),
        api_key: String::new(),
        providers,
    };
    save_config(app, &config)?;
    Ok(())
}

/// 获取本设备名称
pub fn get_device_name(app: &tauri::AppHandle) -> Result<String, String> {
    Ok(load_config(app)?.device_name)
}

/// 设置本设备名称
pub fn set_device_name(app: &tauri::AppHandle, name: String) -> Result<(), String> {
    let mut config = load_config(app)?;
    config.device_name = name;
    save_config(app, &config)
}

/// 对端指纹是否已在配对白名单（接收端权威校验用）
pub fn is_paired(app: &tauri::AppHandle, fingerprint: &str) -> bool {
    if fingerprint.is_empty() {
        return false;
    }
    load_config(app)
        .map(|c| c.paired_fingerprints.iter().any(|fp| fp == fingerprint))
        .unwrap_or(false)
}

/// 把对端指纹加入配对白名单（幂等）
pub fn add_paired(app: &tauri::AppHandle, fingerprint: &str) -> Result<(), String> {
    if fingerprint.is_empty() {
        return Err("空指纹".to_string());
    }
    let mut config = load_config(app)?;
    if !config.paired_fingerprints.iter().any(|fp| fp == fingerprint) {
        config.paired_fingerprints.push(fingerprint.to_string());
        save_config(app, &config)?;
    }
    Ok(())
}

/// 从配对白名单移除对端指纹（一并从「我的设备」名单移除）
pub fn remove_paired(app: &tauri::AppHandle, fingerprint: &str) -> Result<(), String> {
    let mut config = load_config(app)?;
    config.paired_fingerprints.retain(|fp| fp != fingerprint);
    config.mine_fingerprints.retain(|fp| fp != fingerprint);
    save_config(app, &config)
}

/// 对端是否被标记为「我的设备」（全量双向同步的权威开关，接收端/出站都校验）
pub fn is_mine(app: &tauri::AppHandle, fingerprint: &str) -> bool {
    if fingerprint.is_empty() {
        return false;
    }
    load_config(app)
        .map(|c| c.mine_fingerprints.iter().any(|fp| fp == fingerprint))
        .unwrap_or(false)
}

/// 设置/取消某设备为「我的设备」。设为 mine 前要求已配对（不允许给陌生设备开全量同步）。
pub fn set_device_mine(app: &tauri::AppHandle, fingerprint: &str, mine: bool) -> Result<(), String> {
    if fingerprint.is_empty() {
        return Err("空指纹".to_string());
    }
    let mut config = load_config(app)?;
    if mine {
        if !config.paired_fingerprints.iter().any(|fp| fp == fingerprint) {
            return Err("该设备尚未配对，不能标记为『我的设备』".to_string());
        }
        if !config.mine_fingerprints.iter().any(|fp| fp == fingerprint) {
            config.mine_fingerprints.push(fingerprint.to_string());
        }
    } else {
        config.mine_fingerprints.retain(|fp| fp != fingerprint);
    }
    save_config(app, &config)
}

// ============= 旧版本数据迁移 =============

/// 旧版本的 identifier 列表（用于数据迁移）；手机从没装过旧 identifier，整段只在桌面编译
#[cfg(desktop)]
const OLD_IDENTIFIERS: &[&str] = &["com.jdnotes.dev"];

/// 从旧 identifier 目录迁移数据到当前目录
/// 应在应用启动时、数据库初始化之前调用
#[cfg(desktop)]
pub fn migrate_from_old_identifier(app: &tauri::AppHandle) -> Result<(), String> {
    let current_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    let current_db = current_dir.join("jdnotes.db");
    let current_config = current_dir.join(CONFIG_FILE);

    // 如果当前目录已有数据库文件，不需要迁移
    if current_db.exists() {
        log::info!("当前目录已有数据库，跳过旧版本迁移");
        return Ok(());
    }

    // 查找旧 identifier 目录
    // app_data_dir 的结构: .../AppData/Roaming/<identifier>/
    // 通过替换当前 identifier 来构建旧路径
    let parent = match current_dir.parent() {
        Some(p) => p,
        None => return Ok(()),
    };

    for old_id in OLD_IDENTIFIERS {
        let old_dir = parent.join(old_id);
        let old_db = old_dir.join("jdnotes.db");
        let old_config = old_dir.join(CONFIG_FILE);

        log::info!("检查旧目录: {:?}", old_dir);

        if !old_db.exists() {
            log::info!("旧目录无数据库文件，跳过: {:?}", old_dir);
            continue;
        }

        log::info!("发现旧版本数据! 旧目录: {:?}", old_dir);

        // 确保当前目录存在
        if !current_dir.exists() {
            fs::create_dir_all(&current_dir)
                .map_err(|e| format!("创建当前数据目录失败: {}", e))?;
        }

        // 迁移数据库文件
        log::info!("迁移数据库: {:?} -> {:?}", old_db, current_db);
        fs::copy(&old_db, &current_db)
            .map_err(|e| format!("迁移数据库文件失败: {}", e))?;

        // 迁移配置文件（如果存在且当前没有）
        if old_config.exists() && !current_config.exists() {
            log::info!("迁移配置文件: {:?} -> {:?}", old_config, current_config);

            // 读取旧配置，检查是否有自定义 database_path 需要更新
            if let Ok(content) = fs::read_to_string(&old_config) {
                if let Ok(mut config) = serde_json::from_str::<AppConfig>(&content) {
                    // 如果旧配置的 database_path 指向旧目录内，需要清除
                    // 因为数据已经迁移到新目录的默认位置了
                    if let Some(ref db_path) = config.database_path {
                        let db_path_buf = PathBuf::from(db_path);
                        if db_path_buf.starts_with(&old_dir) {
                            log::info!("旧配置的 database_path 指向旧目录，清除: {}", db_path);
                            config.database_path = None;
                        }
                    }
                    // 保存调整后的配置到新目录
                    let new_content = serde_json::to_string_pretty(&config)
                        .map_err(|e| format!("序列化迁移配置失败: {}", e))?;
                    fs::write(&current_config, new_content)
                        .map_err(|e| format!("保存迁移配置失败: {}", e))?;
                } else {
                    // 配置解析失败，直接复制
                    fs::copy(&old_config, &current_config)
                        .map_err(|e| format!("复制配置文件失败: {}", e))?;
                }
            }
        }

        log::info!("旧版本数据迁移完成（从 {} 迁移）", old_id);

        // 只迁移第一个找到的旧目录
        return Ok(());
    }

    log::info!("未发现旧版本数据，无需迁移");
    Ok(())
}
