mod attachments;
mod commands;
mod db;
mod mcp_server;
mod models;
mod sync;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 发布版：封死"外部经调试端口接管本应用"这条路。任何自动化（Playwright 等）要
    // 驱动我们，都必须让 WebView2 的 msedgewebview2.exe 带上 --remote-debugging-port/pipe
    // 开出 CDP 端口。双保险：① 启动前拒绝已知注入源（环境变量 / 注册表策略），端口根本
    // 不开、无竞态；② 启动后持续巡检 webview 子进程命令行，命中即自杀，兜住未知注入源。
    // 调试版全部跳过——本机 CDP 自动化测试依赖这条路。
    #[cfg(not(debug_assertions))]
    anti_remote_debug::guard_before_launch();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 已有实例运行时，显示并聚焦窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // 启动后巡检：兜住启动前静态检查漏掉的任何注入源（webview 一旦带调试参数就自杀）
            #[cfg(not(debug_assertions))]
            anti_remote_debug::spawn_watch();

            // 创建系统托盘菜单
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // 创建系统托盘图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Lapis")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        // 发 mDNS goodbye 让对方立即从设备列表清除本机
                        sync::shutdown_mdns();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 设置日志插件（仅在开发模式）
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 从旧版本 identifier (com.jdnotes.dev) 迁移数据
            if let Err(e) = db::migrate_from_old_identifier(app.handle()) {
                log::error!("旧版本数据迁移失败: {}", e);
                // 迁移失败不阻止启动，继续使用新目录
            }

            // 获取数据库完整路径（考虑用户自定义配置）
            let db_path = db::get_database_path(app.handle())
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            let db_url = format!("sqlite:{}", db_path.to_string_lossy());
            
            log::info!("数据库路径: {}", db_url);

            // 创建迁移
            let migrations = vec![
                Migration {
                    version: 1,
                    description: "create initial tables",
                    sql: db::get_init_sql(),
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 2,
                    description: "add conversations and chat enhancements",
                    sql: include_str!("../migrations/002_conversations.sql"),
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 3,
                    description: "remove role check constraint for tool calls",
                    sql: include_str!("../migrations/003_remove_role_check.sql"),
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 4,
                    description: "add uuid for multi-device sync",
                    sql: include_str!("../migrations/004_sync.sql"),
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 5,
                    description: "add base snapshot and conflict flag for 3-way merge",
                    sql: include_str!("../migrations/005_sync_merge.sql"),
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 6,
                    description: "add is_private flag to exclude notes from sync",
                    sql: include_str!("../migrations/006_private.sql"),
                    kind: MigrationKind::Up,
                },
                Migration {
                    version: 7,
                    description: "add deleted_notes tombstone to prevent resurrection on sync",
                    sql: include_str!("../migrations/007_deleted_tombstone.sql"),
                    kind: MigrationKind::Up,
                },
            ];

            // 注册 SQL 插件
            app.handle().plugin(
                SqlBuilder::default()
                    .add_migrations(&db_url, migrations)
                    .build(),
            )?;

            // 启动 MCP Server
            mcp_server::register_in_ai_tools();
            let db_path_for_mcp = db_path.clone();
            let app_handle_for_mcp = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                mcp_server::start_mcp_server(db_path_for_mcp, app_handle_for_mcp).await;
            });

            // 启动局域网同步基础设施（TCP 监听 + mDNS 服务注册）
            // 提前到 setup，让用户即使没打开「设备同步」页也能被对端发现
            let db_path_for_lan = db_path.clone();
            let app_handle_for_lan = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                sync::init_lan_sync(
                    app_handle_for_lan,
                    db_path_for_lan.to_string_lossy().to_string(),
                )
                .await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 数据库管理
            commands::get_database_path,
            commands::get_database_url,
            commands::get_database_info,
            commands::copy_database_to,
            commands::change_database_location,
            // 导入导出
            commands::export_database_json,
            commands::import_database_json,
            commands::import_from_indexeddb,
            // AI 配置
            commands::get_ai_config,
            commands::save_ai_config,
            commands::get_config_path,
            commands::get_search_api_config,
            commands::save_search_api_config,
            commands::get_device_name,
            commands::set_device_name,
            // 联网功能
            commands::web_search,
            commands::web_fetch,
            commands::get_location,
            // 多设备同步
            commands::sync_get_info,
            commands::sync_connect_lan,
            commands::sync_export_package,
            commands::sync_import_package,
            commands::sync_iroh_get_id,
            commands::sync_accept_pairing,
            commands::sync_revoke_pairing,
            commands::sync_is_paired,
            commands::sync_set_device_kind,
            commands::sync_is_mine,
            commands::sync_iroh_connect,
            commands::sync_iroh_probe,
            commands::sync_iroh_push_note,
            commands::sync_iroh_push_notes,
            commands::sync_lan_push_note,
            commands::sync_lan_push_notes,
            commands::sync_lan_discover,
            // 图片附件
            commands::save_attachment_base64,
            commands::save_attachment_from_path,
            commands::get_attachment_path,
            commands::read_attachment_data_url,
            commands::sync_gc_attachments,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 反远程调试注入（仅发布版）。CDP 是 Playwright 等接管 WebView2 的唯一通道，
/// 而启用 CDP 必须让 webview 进程带上 --remote-debugging-* 参数；无论参数来自
/// 环境变量还是注册表策略，最终都会落在 msedgewebview2.exe 的命令行上。
#[cfg(not(debug_assertions))]
mod anti_remote_debug {
    const NEEDLES: [&str; 3] = [
        "--remote-debugging-port",
        "--remote-debugging-pipe",
        "--remote-debugging-address",
    ];

    fn has_needle(s: &str) -> bool {
        let l = s.to_ascii_lowercase();
        NEEDLES.iter().any(|n| l.contains(n))
    }

    /// 启动前：拒绝已知注入源，命中即不启动——端口永远不会开，无竞态窗口。
    pub fn guard_before_launch() {
        // ① 环境变量：Playwright/自动化最常用（WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS 塞端口）
        if let Ok(v) = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS") {
            if has_needle(&v) {
                std::process::exit(1);
            }
        }
        // 无论如何清掉附加参数/目录重定向，避免子 webview 继承
        std::env::remove_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS");
        std::env::remove_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER");
        std::env::remove_var("WEBVIEW2_USER_DATA_FOLDER");

        // ② 注册表策略覆盖（WebView2 AdditionalBrowserArguments，HKCU/HKLM）
        #[cfg(windows)]
        if registry_has_debug_flag() {
            std::process::exit(1);
        }
    }

    /// 启动后：持续巡检 webview 子进程命令行，兜住启动前没覆盖的注入源。
    pub fn spawn_watch() {
        std::thread::spawn(|| {
            let self_pid = std::process::id();
            loop {
                if webview_has_debug_flag(self_pid) {
                    // 检测到远程调试注入：拒绝在被接管状态下继续运行
                    std::process::exit(1);
                }
                std::thread::sleep(std::time::Duration::from_millis(400));
            }
        });
    }

    fn webview_has_debug_flag(self_pid: u32) -> bool {
        use std::collections::HashMap;
        use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

        let mut sys = System::new();
        // 必须显式开启读命令行——默认 refresh 为性能不读 cmd()，否则 p.cmd() 恒空
        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::new().with_cmd(UpdateKind::Always),
        );

        // pid -> parent pid，用于判定某进程是否本应用的后代
        let mut parent: HashMap<u32, u32> = HashMap::new();
        for (pid, p) in sys.processes() {
            if let Some(par) = p.parent() {
                parent.insert(pid.as_u32(), par.as_u32());
            }
        }
        let is_descendant = |start: u32| -> bool {
            let mut cur = start;
            for _ in 0..64 {
                match parent.get(&cur) {
                    Some(&par) if par == self_pid => return true,
                    Some(&par) => cur = par,
                    None => return false,
                }
            }
            false
        };

        for (pid, p) in sys.processes() {
            let name = p.name().to_string_lossy().to_ascii_lowercase();
            if !name.contains("msedgewebview2") {
                continue;
            }
            if !is_descendant(pid.as_u32()) {
                continue;
            }
            let joined = p
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy().to_ascii_lowercase())
                .collect::<Vec<_>>()
                .join(" ");
            if NEEDLES.iter().any(|n| joined.contains(n)) {
                return true;
            }
        }
        false
    }

    /// 递归扫描 WebView2 策略注册表子树的全部字符串值，命中调试参数即 true。
    #[cfg(windows)]
    fn registry_has_debug_flag() -> bool {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
        use winreg::RegKey;
        let roots = [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE];
        let subtrees = [
            r"Software\Policies\Microsoft\Edge\WebView2",
            r"Software\Microsoft\Edge\WebView2",
        ];
        for root in roots {
            let hk = RegKey::predef(root);
            for sub in subtrees {
                if let Ok(key) = hk.open_subkey(sub) {
                    if scan_key(&key, 0) {
                        return true;
                    }
                }
            }
        }
        false
    }

    #[cfg(windows)]
    fn scan_key(key: &winreg::RegKey, depth: u32) -> bool {
        if depth > 4 {
            return false;
        }
        for (_, value) in key.enum_values().flatten() {
            if has_needle(&value.to_string()) {
                return true;
            }
        }
        for name in key.enum_keys().flatten() {
            if let Ok(child) = key.open_subkey(&name) {
                if scan_key(&child, depth + 1) {
                    return true;
                }
            }
        }
        false
    }
}
