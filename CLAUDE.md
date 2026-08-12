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
- **版本**：2.2.1
- **标识符**：com.jdnotes.app
- **窗口**：1556x887（默认=最小，逻辑内容尺寸；无边框窗口外框会大 16x9 隐形拉伸边框），无边框 (decorations: false)
- **前端开发端口**：5173
- **GitHub**：zexadev/lapisnote
- **品牌**：Zexa (zexa.cc)

---

## 基建

- **CI/CD**：GitHub Actions 构建发布（`.github/workflows/release.yml`，推 `v*` tag 触发，windows-latest）。Release body 从 `docs/src/content/changelog.mdx` 里手写的 `## vX.Y.Z` 小节抽取——**更新日志始终人写，不用 commit 自动生成**，抽不到直接让 workflow 失败。`latest.json` 由 tauri-action 生成上传，不再手工拼
- **文档站**：Nextra 4 (Next.js)，位于 `docs/`，静态导出
- **文档部署**：Cloudflare Pages，域名 jdnotes.zexa.cc
- **数据库**：SQLite（通过 tauri-plugin-sql；前端 db.ts 直接执行 SQL，plugin 在 Rust 侧原生跑）
- **Tauri 插件**：log, notification, sql(sqlite), dialog, fs, opener, updater, process
- **发布状态**：v2.0.0 已于 2026-07-28 正式发布。仓库最终名 `zexadev/lapisnote`（jdnotes → lapis → lapisnote，lapis 与既有 GitHub 项目及商业软件撞名故加 note 后缀；应用品牌仍叫 Lapis）。Release 资产齐全（exe/msi + 双 sig + latest.json）、updater 端点已验证 200。旧地址 `zexadev/jdnotes`、`zexadev/lapis` 均由 GitHub 自动重定向，**这两个旧名永不复用**（复用即断老版本 updater 的重定向链）。

---

## 关键文件路径

| 文件 | 说明 |
|------|------|
| `src-tauri/tauri.conf.json` | Tauri 配置、版本号 |
| `src-tauri/Cargo.toml` | Rust 依赖、版本号 |
| `src-tauri/src/db.rs` | 配置管理、AI 来源、数据库路径 |
| `src-tauri/src/commands.rs` | Tauri 后端命令 |
| `src-tauri/src/lib.rs` | 插件注册、命令注册；发布版禁 WebView2 CDP 注入（防君子）：run() 开头 remove_var 清 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS 等三个变量——Playwright 靠它塞 --remote-debugging-port 开调试端口接管页面，创建 webview 前清掉即失效；仅 release，debug 保留供本机 CDP 测试。（不做注册表扫描/进程巡检那套军备竞赛，防不了同权限攻击者，数据真正保护靠 DB 落盘加密[roadmap]） |
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
| `src/components/ai/chat/` | AI 侧栏组件族（分块 memo 流式 Markdown、ThinkingBlock 思考折叠、ToolCallCard、ChatInput 一体化输入卡——模型选择器/占用进度条在卡内底行+粘贴/拖拽附图+图片预览+挂载自动聚焦、ModelPicker 带窗口 badge、ConversationSwitcher 对话下拉——行内重命名/删除两段确认/底部新建、CompactDivider 压缩点分隔线、useStickToBottom 粘底、字符级平滑排字在 useChat；侧栏开合为宽度滑入滑出动画） |
| `src/hooks/useChat.ts` | 聊天状态机（thinking/text/tool 段、完成/停止/出错统一落库到流开始时捕获的 streamTargetRef、skipPersistRef 竞态防护、平滑排字 drain 循环、上下文压缩 runCompaction/自动压缩/contextUsage 指示、切笔记/切对话统一中断保存 interruptStreamAndSavePartial、对话自动命名 maybeAutoTitleConversation——仅默认「对话 N」标题才起名） |
| `src/hooks/useAIStream.ts` | 模型调用层（4 provider 流式+工具循环、429/5xx 指数退避重试 callWithRetry、旧工具结果 microcompact 折叠、Anthropic prompt cache + 旧模型 max_tokens 400 回退、generateOnce 单次生成供压缩用） |
| `src/lib/contextBudget.ts` | 上下文预算（token 估算 CJK=1/字·其他/3.5、每模型真实窗口表 inferContextWindow、手填 contextWindow 优先、64k 兜底、自动压缩阈值 0.7、图片/工具 schema 开销、压缩器系统提示） |
| `src/lib/tagColor.ts` | 标签颜色（标签名 djb2 哈希 → 12 色盘，零存储、处处一致；侧栏图标与 TagsInput chip 共用） |
| `src/components/layout/Sidebar.tsx` | 左侧导航（标签区按使用数降序、默认 Top8+激活钉住、展开全部带筛选——标签上百平铺列表失控） |
| `src/contexts/ThemeContext.tsx` | 主题（切换用 View Transitions：toggleTheme 可传扩散原点——主题开关传自己中心 → clip-path 圆形揭示 700ms（data-theme-vt=circle 关掉默认交叉淡化，否则打架）；无原点入口如命令面板 → 整页交叉淡化。theme-switching 瞬态禁全部元素级过渡——各处 transition-colors 时长不一逐个变色显得零碎；主题开关自身动画豁免） |
| `src/hooks/useEditorAI.ts` | 编辑器内联 AI（Cursor 式就地 diff：原文标 aiOld 红删除线保留、新文本 aiHighlight 绿标紧随流式生长、接受/放弃/重试/追加指令按范围操作；插入必须用显式 marks 建文本节点——tr.insertText 会继承插入点 marks 导致红标漏进正文；换行语义：开头 \n 丢弃、\n\n 用 tr.split 真分段（range.to +2）、单 \n 硬换行、尾部换行悬挂跨 chunk） |
| `src/components/ai/AIReviewToolbar.tsx`·`AIInlinePrompt.tsx`·`AIOldMark.ts` | 浮动审查条（跟随生成位置，Tab/Ctrl+Enter 接受、Esc 放弃、重试、追加指令）·Ctrl+J 输入条（快捷动作 chips，为唯一 AI 面板——气泡菜单/斜杠「自由提问」都只是它的入口）·原文红标 mark |
| `src/lib/aiTools.ts` | AI 工具层（结果必须带 id、读取带截断分页 offset、append_note/list_notes、Gemini 空 schema 兼容） |
| `src/lib/chatParts.ts` | assistant 消息 parts JSON 解析（UI 渲染与回传模型共用，回传只取 text 段） |
| `src/lib/db.ts` | 前端数据库操作、初始化欢迎笔记 |
| `src/components/editor/Editor.tsx` | Tiptap 编辑器主组件（userTouchedRef：打开后扩展的规范化事务如 fixTables 不当作编辑上报——否则没编辑就刷 updated_at；CodeBlock language 属性 parseHTML 必须回退 language-xxx class，只认 data-language 会把 markdown 代码块语言洗成 plaintext；代码粘贴在 handlePaste 拦截——vscode-editor-data 直接建带语言代码块、含 \`\`\` 围栏的纯文本走块级 insertContent，默认 clipboardTextParser 的开放 slice 会把代码块拍成行内裸文本） |
| `src/components/editor/EditorToolbar.tsx` | 编辑器固定工具栏（格式/列表/待办/图片） |
| `src/components/editor/ResizableImage.tsx` | 图片节点组件（预览/缩放/删除） |
| `src/components/editor/SlashCommand.tsx` | 斜杠命令菜单（编辑器命令 + AI 命令；过滤词=编辑器里 / 后的真实文本——中文/IME 天然支持，keywords 拼音/英文别名，键盘 capture 拦截防 Enter 漏进编辑器换行） |
| `src/hooks/useSlashCommand.ts` | 斜杠命令逻辑（位置计算/命令执行/slashQuery 产出/光标移出即关） |
| `src/components/editor/NoteRefMenu.tsx`·`src/hooks/useNoteRefMenu.ts` | 笔记引用选择弹窗（输入 `[[` 触发，选中插入 `note://<uuid>` 链接） |
| `src/components/editor/WikiRef.ts` | 字面 `[[标题]]` 渲染扩展（ProseMirror 装饰：常态藏中括号显 chip、选区移入显括号；Backspace/Delete 整体删；点击跳转在 Editor 的 mousedown 处理） |
| `src/components/editor/SafeHtmlBlock.ts` | Markdown 解析防吞扩展（html:true 下未闭合 `<style>`/`<script>`/注释会把后文连同图片引用吞到文末：markdown-it html_block 有界化到空行 + raw-text 标签转义防 DOMParser 二次吞） |
| `src/components/editor/Backlinks.tsx` | 反向链接面板（`noteOperations.findBacklinks` 懒查询 note://uuid + 字面 [[标题]]） |
| `src/components/layout/MainContent.tsx` | 主内容区布局（标签/工具栏/编辑器） |
| `src/components/calendar/` | 日历页（CalendarView 容器=头部/键盘/拖拽/导出菜单、MonthGrid 6 周月网格+chip、DayPanel 常驻日面板、NoteChip 笔记/提醒 chip、ReminderNotification 全局提醒卡）；单月视图+日面板形态，周一起始；提醒 chip 落在提醒日；拖 chip 挪 createdAt（仅创建时间轴）/拖提醒改期；双击格子/Enter 在该日新建（非今天 createdAt=该日正午） |
| `src/hooks/useCalendarPage.ts` | 日历页数据/导航（6 周网格范围查询、选日跨月跟随、dateField 记忆 localStorage calendar.dateField、可选 initialDate 挂载定位——概览热力图点格直达用） |
| `src/pages/DashboardPage.tsx` | 数据概览页（入口面板：KPI 卡可点进对应视图、周对齐热力图点格直达日历该日、待办提醒卡点行开笔记、趋势 7/30 切换记忆 localStorage dashboard.trendRange、Top 标签用 tagColor 且点击进标签视图、自绘跟随光标 tooltip 不用原生 title） |
| `src/hooks/useDashboardStats.ts` | 概览统计（日期键一律 formatDateKey 本地时区——toISOString 是 UTC 会跨日归错；streak 今天未写从昨天起算不断签；reminderItems 过期在前标红） |
| `src/hooks/useReminders.ts` | 全局提醒引擎（App 层唯一实例：到期查询+精确定时器+30s 轮询保底）；日历页不再自跑提醒轮询——曾因双实例双弹系统通知 |
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

2. **更新版本号**（三处，缺一处就会漂——`package.json` 曾漏改，一路停在 2.0.0 直到 2.2.0）
   - `src-tauri/tauri.conf.json` 中的 `version`（构建实际读这份）
   - `src-tauri/Cargo.toml` 中的 `version`
   - `package.json` 中的 `version`
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

7. **CI 自动打包发布**
   推 tag 即触发 `.github/workflows/release.yml`，无需本地构建。它会：
   - 用 `TAURI_SIGNING_PRIVATE_KEY` / `..._PASSWORD` 两个仓库 secret 签名
   - 从 `docs/src/content/changelog.mdx` 抽 `## vx.y.z` 小节当 Release body（**抽不到直接失败**，不静默回退）
   - 上传 exe/msi + 双 sig + `latest.json`（`updaterJsonPreferNsis: true`，更新通道走 setup.exe）

   跟进：`gh run watch` 或 `gh run list --workflow=release.yml --limit 1`

   **签名密钥必须与线上 pubkey 同一把**（`src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`）。签名 key 与包内 pubkey 不匹配时，产物照样能签能发，但所有客户端验签失败、更新静默全断，且要等发版后才暴露——2026-03 踩过：CI 配了一把新 key（`RWTV/ePB…`）却没改 pubkey，随后撤 CI 并把 pubkey revert 回 `RWRH2d76…`。

   **改 key 是三处联动，缺一不可**：`tauri.conf.json` 的 pubkey + 仓库 secret `TAURI_SIGNING_PRIVATE_KEY` + 同名 `..._PASSWORD`。所以不提供 `signer:generate` 之类的一键生成脚本（原先那个还默认写进项目内的 `~/.tauri/`，导致私钥进了公开仓库）。要换 key：

   ```powershell
   pnpm tauri signer generate --ci -p '<新密码>' -w "$env:USERPROFILE\.tauri\lapis.key"
   # 把 lapis.key.pub 的内容原样填进 tauri.conf.json 的 pubkey（该文件本身就是 base64，别再编码一次）
   gh secret set TAURI_SIGNING_PRIVATE_KEY < "$env:USERPROFILE\.tauri\lapis.key"
   gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --body '<新密码>'
   ```

   **私钥一律放仓库外**（`%USERPROFILE%\.tauri\lapis.key`）。`.gitignore` 有 `**/.tauri/` 与 `*.key` 兜底。

   **换 key 会断更新链**：老版本用旧 pubkey 验签，收不到新版本，必须手动下载一次。换 key 那一版的 changelog 和 Release notes 必须写明这点。

8. **等待文档站部署**
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
- **裸文本不自动成链**（`Editor.tsx` 里 StarterKit `link: false`，改用独立 `Link.extend({addPasteRules: () => []}).configure({autolink: false})`）。**别再打开 autolink，也别指望换 linkify 引擎能修好**：linkifyjs 的邮箱 local part 向前贪吃到空白为止，中文标点/`|`/`/`/`-` 全算合法字符，`备注：a@b.com` 整条吞成 `mailto:备注：a@b.com`，`pw----user@b.com` 把前一字段吃进地址，URL 侧把中文句号吃进 href；`-` 在 local part 里本就合法，边界无解。且它落盘——序列化成 `[文本](mailto:…)` 写进 `notes.content`，随导出/同步/MCP 扩散。参照 VSCode `linkComputer.ts`：只认 `http/https/file` + `://`，无 email 分支，从不回头扫起点；其 Markdown 预览还额外 `linkify.set({fuzzyLink: false})`。autolink 只管打字路径，粘贴走 `addPasteRules`（无条件批量 linkify，不受 autolink/linkOnPaste 约束），两条都要堵；`linkOnPaste` 保留（需选区且剪贴板整体恰为一个链接，属手动动作）
- 外部链接：`Ctrl/⌘+Click` 用系统浏览器打开（在 Editor 的 `click` 处理）；**悬停出操作卡**（`LinkPopover.tsx`：URL+打开/复制/编辑/取消链接，编辑态行内输入+无协议自动补 https://）
- 插入/编辑链接统一走 LinkPopover（气泡菜单链接按钮也是它——window.prompt 在 WebView2 里不可用，别用）
- 内部引用：单击直接跳转（在 Editor 的 `mousedown` 处理，抢在光标落入前跳，避免误触发编辑态/跳转落空），不出悬停卡
- 右键菜单：网页原生菜单全局禁用（桌面软件不出浏览器菜单），换 `ContextMenu.tsx` 自绘——可编辑区出 复制/剪切/粘贴/全选，任意区域有选区出 复制，空白无菜单。菜单项 mousedown 必须 preventDefault（否则点击瞬间清选区，复制空）。粘贴用 navigator.clipboard.readText + 合成 paste 事件走完整粘贴管线；readText 需窗口有 OS 焦点（真实右键必有，测试环境需 AppActivate）。另：PowerShell 读剪贴板中文乱码是 GBK 控制台编码，经 UTF-8 文件中转读，别误判剪贴板坏了

### 笔记引用 / 双向链接
两种引用形式并存，**渲染成 chip、单击跳转、都计入反向链接**：
- **手动引用**：编辑器输入 `[[` → `NoteRefMenu` 选择 → 插入 `[标题](note://<uuid>)` Link mark。按 **uuid** 解析，改名/跨设备同步不断。
- **字面 `[[标题]]`**：AI 经 MCP 写入 / 手打 / 粘贴的纯文本，`WikiRef` 装饰渲染成 chip（常态藏中括号、光标移入显）。按**标题**解析（改名会断，因 AI 只有标题、拿不到 uuid）。
- 反向链接：`findBacklinks(uuid, title)` 同时 LIKE 匹配 `note://uuid` 与 `[[标题]]`。
- **待办（未定）**：两形式「手感统一」——note:// chip 目前带 🔗 图标、删除逐字，字面 chip 无图标、整体删；是否统一外观 + 给 note:// 加整体删除，待用户拍板（用户曾问「交互统一了吗」，尚未决定方向）。

### 引用键取舍
引用键用 **uuid**（同步/改名安全），不是自增 id（跨设备不同）。`Note` 接口已暴露 `uuid`；导入 JSON 保留原 uuid，引用跨导入不断链。
