# jdnotes 项目说明

## 重要原则

**每执行一步前必须先向用户汇报计划，等待确认后再执行。**
不得连续执行多个破坏性或不可逆操作（如 git push、release 发布、tag 删除）而不经用户同意。

**git commit 信息必须使用中文。**
**git commit 不要加 Co-Authored-By 行。**

---

## 发布流程

发布新版本时，按以下步骤逐一执行，每步执行前告知用户：

1. **确认工作区干净**
   ```bash
   git status
   git log --oneline -3
   ```

2. **更新版本号**
   - `src-tauri/tauri.conf.json` 中的 `version`
   - `src-tauri/Cargo.toml` 中的 `version`
   - patch 修复：1.2.x → 1.2.(x+1)
   - 新功能：1.2.x → 1.3.0

3. **提交版本号变更**
   ```bash
   git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
   git commit -m "发布 vx.y.z"
   ```

4. **推送代码**
   ```bash
   git push origin main
   ```

5. **打 Tag 并推送**
   ```bash
   git tag vx.y.z
   git push origin vx.y.z
   ```

6. **等待 CI 自动构建发布**
   推送 tag 后 GitHub Actions 自动构建 Tauri 安装包并创建 GitHub Release。
   文档站通过 Cloudflare Pages 自动部署。

---

## 文档同步规则

**每次修改代码后，必须同步更新 `docs/` 文档：**

- 新增功能 → 更新对应功能文档页
- 修改现有功能行为 → 更新对应文档
- 发布新版本 → 更新 changelog 页面，内容同步到 GitHub Release body
- 修改 CLAUDE.md 规则或项目结构时，同步更新本文件

---

## 基建

- **CI/CD**: GitHub Actions，推送 tag 自动构建 Tauri 安装包 + 发布 Release
- **文档站**: Nextra (Next.js)，位于 `docs/`
- **文档部署**: Cloudflare Pages，域名 jdnotes.zexa.cc
- **品牌**: Zexa (zexa.cc)

---

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
