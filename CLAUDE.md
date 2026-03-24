# jdnotes 项目说明

## 重要原则

**每执行一步前必须先向用户汇报计划，等待确认后再执行。**
不得连续执行多个破坏性或不可逆操作（如 git push、release 发布、tag 删除）而不经用户同意。

**git commit 信息必须使用中文。**
**git commit 不要加 Co-Authored-By 行。**

---

## 项目概况

- **名称**：JD Notes — 简洁高效的本地笔记应用
- **技术栈**：Tauri v2 (tauri 2.9.5, tauri-build 2.5.3) + Vite + React + TypeScript
- **包管理器**：pnpm
- **版本**：1.5.0
- **标识符**：com.jdnotes.app
- **窗口**：1200x800，无边框 (decorations: false)
- **前端开发端口**：5173
- **GitHub**：zexadev/jdnotes
- **品牌**：Zexa (zexa.cc)

---

## 基建

- **CI/CD**：已移除 GitHub Actions 自动构建，手动打包发布
- **文档站**：Nextra 4 (Next.js)，位于 `docs/`，静态导出
- **文档部署**：Cloudflare Pages，域名 jdnotes.zexa.cc
- **数据库**：SQLite（通过 tauri-plugin-sql）
- **Tauri 插件**：log, notification, sql(sqlite), dialog, fs, opener, updater, process

---

## 关键文件路径

| 文件 | 说明 |
|------|------|
| `src-tauri/tauri.conf.json` | Tauri 配置、版本号 |
| `src-tauri/Cargo.toml` | Rust 依赖、版本号 |
| `src-tauri/src/db.rs` | 配置管理、AI 来源、数据库路径 |
| `src-tauri/src/commands.rs` | Tauri 后端命令 |
| `src-tauri/src/lib.rs` | 插件注册、命令注册 |
| `src/hooks/useSettings.ts` | AI 多来源配置 Hook（useAIConfig / useSettings） |
| `src/components/modals/ChangelogModal.tsx` | 应用内更新日志（CHANGELOG_DATA 数组） |
| `src/lib/db.ts` | 前端数据库操作、初始化欢迎笔记 |
| `src/components/editor/Editor.tsx` | Tiptap 编辑器主组件 |
| `src/components/editor/EditorToolbar.tsx` | 编辑器固定工具栏（格式/列表/待办/图片） |
| `src/components/editor/ResizableImage.tsx` | 图片节点组件（预览/缩放/删除） |
| `src/components/editor/SlashCommand.tsx` | 斜杠命令菜单（编辑器命令 + AI 命令） |
| `src/hooks/useSlashCommand.ts` | 斜杠命令逻辑（位置计算/命令执行） |
| `src/components/layout/MainContent.tsx` | 主内容区布局（标签/工具栏/编辑器） |
| `src-tauri/src/mcp_server.rs` | MCP HTTP Server（AI 工具集成） |
| `skills/jdnotes-mcp.md` | Claude Code Skill 使用指引 |
| `docs/` | Nextra 文档站（Cloudflare Pages 自动部署） |
| `docs/src/content/changelog.mdx` | 文档站更新日志 |
| `docs/next.config.mjs` | 文档站构建配置 |

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
   - patch 修复：x.y.z → x.y.(z+1)
   - 新功能：x.y.z → x.(y+1).0

3. **更新 changelog**
   - 更新 `docs/src/content/changelog.mdx`，添加新版本的更新说明
   - 更新 `src/components/modals/ChangelogModal.tsx` 中的 `CHANGELOG_DATA` 数组，在顶部添加新版本条目
   - 两处内容保持一致，内容将同步到 GitHub Release body
   - 更新 `README.md`，确保功能特性、快捷键等信息与最新版本一致

4. **提交版本号变更**
   ```bash
   git add src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock docs/src/content/changelog.mdx src/components/modals/ChangelogModal.tsx
   git commit -m "发布 vx.y.z"
   ```

5. **推送代码**
   ```bash
   git push origin main
   ```

6. **打 Tag 并推送**
   ```bash
   git tag vx.y.z
   git push origin vx.y.z
   ```

7. **本地打包**
   ```bash
   cd src-tauri
   pnpm tauri build
   ```
   产物位于 `src-tauri/target/release/bundle/nsis/jdnotes_x.y.z_x64-setup.exe`

8. **创建 GitHub Release 并上传安装包**
   ```bash
   gh release create vx.y.z ./src-tauri/target/release/bundle/nsis/jdnotes_x.y.z_x64-setup.exe --title "vx.y.z" --notes-file docs/src/content/changelog.mdx
   ```
   或使用 changelog 中对应版本的内容作为 release notes。

9. **等待文档站部署**
   文档站通过 Cloudflare Pages 自动部署。

---

## 文档同步规则

**每次修改代码后，必须同步更新 `docs/` 文档：**

- 新增功能 → 更新对应功能文档页
- 修改现有功能行为 → 更新对应文档
- 发布新版本 → 更新 changelog 页面，内容同步到 GitHub Release body
- 修改 CLAUDE.md 规则或项目结构时，同步更新本文件

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 搜索笔记 |
| `Ctrl+L` | 打开/关闭 AI 侧栏 |
| `Ctrl+J` | 内联提问（选中文本后） |
| `Ctrl+B` | 粗体 |
| `Ctrl+I` | 斜体 |
| `Ctrl+Shift+C` | 代码块 |
| `Ctrl+Click` | 打开链接（类似 VS Code） |

---

## 编辑器功能

### 工具栏
固定在标签栏下方，不随编辑器内容滚动，仅编辑模式显示。包含：
- 文本格式：加粗、斜体、删除线、内联代码
- 列表：无序列表、有序列表、待办列表
- 其他：引用、分割线、代码块、插入图片

### 待办列表
- 扩展：`@tiptap/extension-task-list` + `@tiptap/extension-task-item`（支持嵌套）
- 入口：工具栏按钮 + 斜杠命令 `/`
- Markdown 兼容：`- [ ]` / `- [x]` 自动转换

### 斜杠命令
输入 `/` 触发，菜单分两组：编辑器命令（待办列表）和 AI 命令。弹窗位置根据可视区域预计算，避免超出边界。

### 图片
- 插入方式：工具栏按钮、粘贴、Tauri 原生拖拽（`onDragDropEvent`）
- 存储方式：base64 内嵌
- 显示：居中、最大宽度不超过编辑器容器、圆角 0.5rem
- 交互：拖拽缩放（有最大宽度限制）、点击预览大图、hover 显示删除按钮
- 组件：`ResizableImage.tsx`（NodeView）

### 链接
- `Ctrl+Click` 打开链接，按住 Ctrl 时显示手型光标和加粗下划线
- 普通状态下显示文本光标，可正常编辑
