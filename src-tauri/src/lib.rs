mod commands;
mod db;
mod mcp_server;
mod models;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
            // 创建系统托盘菜单
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // 创建系统托盘图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("JD Notes")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
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
            // 联网功能
            commands::web_search,
            commands::web_fetch,
            commands::get_location,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
