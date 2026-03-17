# jdnotes 项目说明

## 项目概况
- Tauri v2 桌面应用 (tauri 2.9.5, tauri-build 2.5.3)
- 前端: Vite + React (端口 5173)
- 版本: 1.2.0
- 标识符: com.jdnotes.app
- 窗口: 1200x800, 无边框 (decorations: false)
- 插件: log, notification, sql(sqlite), dialog, fs, opener, updater, process
- GitHub: huancheng01/jdnotes

## 关键文件路径
- Tauri 配置: `src-tauri/tauri.conf.json`
- Cargo: `src-tauri/Cargo.toml`
- 自定义 NSIS 脚本: `src-tauri/windows/installer.nsi`
- 安装器图片资源: `src-tauri/windows/ncm-ui/` (background.png, button.png)

## NSIS 自定义安装程序计划 (未完成，用户放弃)

### 目标
实现网易云音乐/QQ 风格的全自定义安装界面 (640x480)，三屏流程：欢迎页、进度页、完成页。

### 方案要点
- 基于 Tauri 默认 NSIS 模板，替换 MUI 页面为 nsDialogs 自定义页面
- 在 `.onGUIInit` 中隐藏 header 和底部按钮栏，内部对话框扩展至全窗口
- 使用 BMP 格式背景图 (NSIS 原生仅支持 BMP)
- 需要在 tauri.conf.json 的 `bundle.windows.nsis` 中添加 `"template": "windows/installer.nsi"`

### 当前状态
- `src-tauri/windows/installer.nsi` 已存在但是简单的骨架代码，未与 Tauri 构建集成
- 图片资源为 PNG 格式 (640x640)，需转换为 BMP (640x480)
- 未找到本地 cargo 缓存中的 Tauri NSIS 模板作为参考
- Tauri v2 NSIS 模板位于 GitHub: `tauri-apps/tauri` dev 分支 `crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi` (~953 行)

### 实施要点备忘
1. 必须保留 Tauri 所有核心 Section (EarlyChecks, WebView2, Install, Uninstall)
2. 必须保留辅助函数 (RestorePreviousInstallLocation, CreateOrUpdateDesktopShortcut 等)
3. 模板使用 Handlebars 变量: `{{product_name}}`, `{{manufacturer}}`, `{{version}}`, `{{install_mode}}`, `{{arch}}` 等
4. 有 NSIS_HOOK_PREINSTALL / POSTINSTALL / PREUNINSTALL / POSTUNINSTALL 钩子点
