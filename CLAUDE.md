# jdnotes 项目说明

## 重要原则

**每执行一步前必须先向用户汇报计划，等待确认后再执行。**
不得连续执行多个破坏性或不可逆操作（如 git push、release 发布、tag 删除）而不经用户同意。

**git commit 信息必须使用中文。**
**git commit 不要加 Co-Authored-By 行。**

---

## 项目概况

- **名称**：Lapis — 简洁高效的本地笔记应用
- **技术栈**：Tauri v2 (tauri 2.9.5, tauri-build 2.5.3) + Vite + React + TypeScript
- **包管理器**：pnpm
- **版本**：2.0.0
- **标识符**：com.jdnotes.app
- **窗口**：1200x800，无边框 (decorations: false)
- **前端开发端口**：5173
- **GitHub**：zexadev/lapis
- **品牌**：Zexa (zexa.cc)

---

## 基建

- **CI/CD**：已移除 GitHub Actions 自动构建，手动打包发布
- **文档站**：Nextra 4 (Next.js)，位于 `docs/`，静态导出
- **文档部署**：Cloudflare Pages，域名 jdnotes.zexa.cc
- **数据库**：SQLite（通过 tauri-plugin-sql；前端 db.ts 直接执行 SQL，plugin 在 Rust 侧原生跑）
- **Tauri 插件**：log, notification, sql(sqlite), dialog, fs, opener, updater, process
- **发布状态（待「发」）**：GitHub 仓库当前仍是 `zexadev/jdnotes`，**尚未改名为 lapis、2.0 未正式发布 release**。因此 updater 端点 `.../zexadev/lapis/releases/latest/download/latest.json` 返回 404、README/文档站的 GitHub 徽章显示 repo not found，**均属预期**，发布后自动恢复。发布 = 改名仓库 + 建 release 传资产（含 latest.json）。

---

## 关键文件路径

| 文件 | 说明 |
|------|------|
| `src-tauri/tauri.conf.json` | Tauri 配置、版本号 |
| `src-tauri/Cargo.toml` | Rust 依赖、版本号 |
| `src-tauri/src/db.rs` | 配置管理、AI 来源、数据库路径 |
| `src-tauri/src/commands.rs` | Tauri 后端命令 |
| `src-tauri/src/lib.rs` | 插件注册、命令注册 |
| `src-tauri/src/sync.rs` | 多设备同步内核（局域网 TCP + iroh 跨网 + 同步包文件、三路合并、设备 ID 持久化、probe、mDNS 自动发现、持久 fingerprint） |
| `src-tauri/src/attachments.rs` | 图片附件内容寻址存储（sha256） |
| `src-tauri/migrations/004_sync.sql`·`005_sync_merge.sql`·`006_private.sql` | 同步 uuid + 三路合并基准/冲突标记 + 私有笔记标记 |
| `src/pages/SettingsPage.tsx` | 设置页左侧导航容器（应用实际使用的设置 UI） |
| `src/pages/settings/SyncSettings.tsx` | 设置「设备同步」页（mDNS 自动发现 / 跨网设备列表 / 同步包 / 清理图片） |
| `src/components/modals/NoteSelectModal.tsx` | 局域网笔记多选同步弹窗（搜索/全选/单选/卡片勾选，自动排除私有笔记） |
| `src/components/modals/PairingCodeModal.tsx` | 首次配对码弹窗（双方各算 6 位数字防中间人） |
| `src/lib/pairing.ts` | 配对码工具（SHA256 派生 + localStorage 白名单） |
| `src/hooks/useSettings.ts` | AI 多来源配置 Hook（useAIConfig / useSettings） |
| `src/components/modals/ChangelogModal.tsx` | 应用内更新日志（CHANGELOG_DATA 数组） |
| `src/components/ai/chat/` | AI 侧栏组件族（分块 memo 流式 Markdown、ThinkingBlock 思考折叠、ToolCallCard、ChatInput 发送↔停止、CompactDivider 压缩点分隔线、useStickToBottom 粘底、字符级平滑排字在 useChat） |
| `src/hooks/useChat.ts` | 聊天状态机（thinking/text/tool 段、完成/停止/出错统一落库到流开始时捕获的 streamTargetRef、skipPersistRef 竞态防护、平滑排字 drain 循环、上下文压缩 runCompaction/自动压缩/contextUsage 指示、切笔记/切对话统一中断保存 interruptStreamAndSavePartial、对话自动命名 maybeAutoTitleConversation——仅默认「对话 N」标题才起名） |
| `src/hooks/useAIStream.ts` | 模型调用层（4 provider 流式+工具循环、429/5xx 指数退避重试 callWithRetry、旧工具结果 microcompact 折叠、Anthropic prompt cache + 旧模型 max_tokens 400 回退、generateOnce 单次生成供压缩用） |
| `src/lib/contextBudget.ts` | 上下文预算（token 估算 CJK=1/字·其他/3.5、每模型真实窗口表 inferContextWindow、手填 contextWindow 优先、64k 兜底、自动压缩阈值 0.7、图片/工具 schema 开销、压缩器系统提示） |
| `src/lib/aiTools.ts` | AI 工具层（结果必须带 id、读取带截断分页 offset、append_note/list_notes、Gemini 空 schema 兼容） |
| `src/lib/chatParts.ts` | assistant 消息 parts JSON 解析（UI 渲染与回传模型共用，回传只取 text 段） |
| `src/lib/db.ts` | 前端数据库操作、初始化欢迎笔记 |
| `src/components/editor/Editor.tsx` | Tiptap 编辑器主组件 |
| `src/components/editor/EditorToolbar.tsx` | 编辑器固定工具栏（格式/列表/待办/图片） |
| `src/components/editor/ResizableImage.tsx` | 图片节点组件（预览/缩放/删除） |
| `src/components/editor/SlashCommand.tsx` | 斜杠命令菜单（编辑器命令 + AI 命令） |
| `src/hooks/useSlashCommand.ts` | 斜杠命令逻辑（位置计算/命令执行） |
| `src/components/editor/NoteRefMenu.tsx`·`src/hooks/useNoteRefMenu.ts` | 笔记引用选择弹窗（输入 `[[` 触发，选中插入 `note://<uuid>` 链接） |
| `src/components/editor/WikiRef.ts` | 字面 `[[标题]]` 渲染扩展（ProseMirror 装饰：常态藏中括号显 chip、选区移入显括号；Backspace/Delete 整体删；点击跳转在 Editor 的 mousedown 处理） |
| `src/components/editor/SafeHtmlBlock.ts` | Markdown 解析防吞扩展（html:true 下未闭合 `<style>`/`<script>`/注释会把后文连同图片引用吞到文末：markdown-it html_block 有界化到空行 + raw-text 标签转义防 DOMParser 二次吞） |
| `src/components/editor/Backlinks.tsx` | 反向链接面板（`noteOperations.findBacklinks` 懒查询 note://uuid + 字面 [[标题]]） |
| `src/components/layout/MainContent.tsx` | 主内容区布局（标签/工具栏/编辑器） |
| `src-tauri/src/mcp_server.rs` | MCP HTTP Server（AI 工具集成；时间戳统一用 `chrono::Utc::now()`） |
| `skills/lapis-mcp.md` | Claude Code Skill 使用指引 |
| `docs/` | 旧 Nextra 文档站（当前线上，Cloudflare Pages，jdnotes.zexa.cc） |
| `docs/src/content/changelog.mdx` | 文档站更新日志 |
| `docs/next.config.mjs` | 文档站构建配置 |
| `D:\project\lapis-docs` | **新文档站**（Vite+React+TS+Tailwind v4 重构，独立 git 仓库，见其自带 CLAUDE.md），目标取代旧 Nextra 站 |

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

7. **本地打包（需签名）**
   构建时必须设置签名密钥环境变量：
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content '.\~\.tauri\jdnotes.key' -Raw
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<密码>'
   pnpm tauri build
   ```
   产物位于：
   - `src-tauri/target/release/bundle/nsis/Lapis_x.y.z_x64-setup.exe` + `.sig`
   - `src-tauri/target/release/bundle/msi/Lapis_x.y.z_x64_en-US.msi` + `.sig`

8. **创建 GitHub Release 并上传全部资产**
   ```bash
   # 创建 Release
   gh release create vx.y.z --title "vx.y.z" --notes "..."
   # 上传全部文件（exe + sig + msi + sig + latest.json）
   gh release upload vx.y.z \
     ./src-tauri/target/release/bundle/nsis/Lapis_x.y.z_x64-setup.exe \
     ./src-tauri/target/release/bundle/nsis/Lapis_x.y.z_x64-setup.exe.sig \
     ./src-tauri/target/release/bundle/msi/Lapis_x.y.z_x64_en-US.msi \
     ./src-tauri/target/release/bundle/msi/Lapis_x.y.z_x64_en-US.msi.sig \
     ./latest.json
   ```
   其中 `latest.json` 需手动创建，格式参考之前版本，包含 version、notes、pub_date、platforms（signature + url）。

9. **等待文档站部署**
   文档站通过 Cloudflare Pages 自动部署。

---

## 文档同步规则

**每次修改代码后，必须同步更新 `docs/` 文档：**

- 新增功能 → 更新对应功能文档页
- 修改现有功能行为 → 更新对应文档
- 发布新版本 → 更新 changelog 页面，内容同步到 GitHub Release body
- 修改 CLAUDE.md 规则或项目结构时，同步更新本文件
- **每次代码变更后，主动评估 `README.md` 是否需要同步**（功能列表、快捷键、安装方式、截图、版本号等），不限发版时

**版本发布说明只写软件功能变更**（新功能、优化、修复），文档站优化、README 更新、SEO 等属于基建，不写入 changelog 和 Release notes。

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 搜索笔记 |
| `Ctrl+L` | 打开/关闭 AI 侧栏 |
| `Ctrl+J` | 内联提问（选中文本后） |
| `Ctrl+\` | 循环切换侧栏（展开/收起/隐藏） |
| `F11` | 沉浸模式（窗口全屏 + 隐藏侧栏/顶栏/笔记列表） |
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
- 存储方式：内容寻址附件（`attachments/<sha256>`，正文存 `attachment://<hash>` 引用；导出 JSON 时还原 base64 自包含）。旧的 base64 内嵌笔记启动时自动迁移
- 显示：居中、最大宽度不超过编辑器容器、圆角 0.5rem
- 交互：拖拽缩放（有最大宽度限制）、点击预览大图、hover 显示删除按钮
- 组件：`ResizableImage.tsx`（NodeView）

### 链接
- 外部链接：`Ctrl/⌘+Click` 用系统浏览器打开（在 Editor 的 `click` 处理）
- 内部引用：单击直接跳转（在 Editor 的 `mousedown` 处理，抢在光标落入前跳，避免误触发编辑态/跳转落空）

### 笔记引用 / 双向链接
两种引用形式并存，**渲染成 chip、单击跳转、都计入反向链接**：
- **手动引用**：编辑器输入 `[[` → `NoteRefMenu` 选择 → 插入 `[标题](note://<uuid>)` Link mark。按 **uuid** 解析，改名/跨设备同步不断。
- **字面 `[[标题]]`**：AI 经 MCP 写入 / 手打 / 粘贴的纯文本，`WikiRef` 装饰渲染成 chip（常态藏中括号、光标移入显）。按**标题**解析（改名会断，因 AI 只有标题、拿不到 uuid）。
- 反向链接：`findBacklinks(uuid, title)` 同时 LIKE 匹配 `note://uuid` 与 `[[标题]]`。
- **待办（未定）**：两形式「手感统一」——note:// chip 目前带 🔗 图标、删除逐字，字面 chip 无图标、整体删；是否统一外观 + 给 note:// 加整体删除，待用户拍板（用户曾问「交互统一了吗」，尚未决定方向）。

### 引用键取舍
引用键用 **uuid**（同步/改名安全），不是自增 id（跨设备不同）。`Note` 接口已暴露 `uuid`；导入 JSON 保留原 uuid，引用跨导入不断链。
