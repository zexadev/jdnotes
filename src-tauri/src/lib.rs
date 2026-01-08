mod commands;
mod db;
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

            // 获取数据库完整路径（考虑用户自定义配置）
            let db_path = db::get_database_path(app.handle())
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            let db_url = format!("sqlite:{}", db_path.to_string_lossy());
            
            log::info!("数据库路径: {}", db_url);

            // 创建迁移
            let migrations = vec![Migration {
                version: 1,
                description: "create initial tables",
                sql: db::get_init_sql(),
                kind: MigrationKind::Up,
            }];

            // 注册 SQL 插件
            app.handle().plugin(
                SqlBuilder::default()
                    .add_migrations(&db_url, migrations)
                    .build(),
            )?;
            
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
            // AI 设置
            commands::get_ai_settings,
            commands::save_ai_settings,
            commands::get_config_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
