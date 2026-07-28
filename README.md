<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./banner-dark.png">
    <img src="./banner-light.png" alt="Lapis — Clarity, kept." width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/zexadev/lapisnote/releases/latest">
    <img src="https://img.shields.io/github/v/release/zexadev/lapisnote?style=flat-square&logo=github" alt="Latest Release">
  </a>
  <a href="https://github.com/zexadev/lapisnote/releases">
    <img src="https://img.shields.io/github/downloads/zexadev/lapisnote/total?style=flat-square&logo=github" alt="Downloads">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-green?style=flat-square" alt="License">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-1.77-DEA584?style=flat-square&logo=rust&logoColor=black" alt="Rust">
  <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite">
</p>

<p align="center">
  <a href="./README.md">中文</a> •
  <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <a href="https://jdnotes.zexa.cc">文档</a> •
  <a href="#-功能特性">功能特性</a> •
  <a href="#-下载安装">下载安装</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-技术架构">技术架构</a> •
  <a href="#-反馈支持">反馈支持</a>
</p>

---

## 📖 简介

**Lapis** 是一款本地优先的桌面笔记应用（Tauri 2 构建）。支持局域网 + 跨网 P2P 加密多设备同步，AI 可经 MCP 直接读写你的笔记库。数据本地存储，隐私安全。

> **前身是 jdnotes（JD Notes）**：自 2.0 起更名为 Lapis。同一应用、同一套数据，老版本直接安装新版即可升级，笔记原样保留。

| | 特性 | 说明 |
|---|---|---|
| 🔄 | **多设备同步** | 局域网自动发现 + 跨网 P2P 加密直连，免费、无中心服务器 |
| 🔌 | **AI Agent 读写** | 内置 MCP Server，Claude Code / Cursor 等 AI 工具可直接在你的本地笔记库查看、创建、追加、修改笔记 |
| 🔗 | **双向链接** | 输入 `[[` 引用其它笔记（或正文直接写 `[[标题]]`），单击跳转 + 自动反向链接 |
| 🤖 | **AI 赋能** | 多平台 AI 助手，支持 DeepSeek / Claude / Gemini / Ollama |
| 🔒 | **本地优先** | 本地 SQLite 存储，断网可用，数据完全掌控在您手中 |
| ⚡ | **轻量高效** | 基于 Rust + Web 技术，安装包约 8MB，启动快速 |

---

## ✨ 功能特性

### 📝 富文本编辑

- **Markdown 支持** — 原生支持 Markdown 语法，所见即所得
- **固定工具栏** — 文本格式、列表、引用、代码块、插入图片等常用操作
- **代码高亮** — 支持 20+ 种编程语言语法高亮
- **图片管理** — 工具栏插入、粘贴、拖拽插入，可缩放和预览大图
- **待办列表** — 支持 `- [ ]` / `- [x]` Markdown 语法，工具栏和斜杠命令快速创建
- **斜杠命令** — 输入 `/` 快速插入各种内容块和 AI 命令
- **代码粘贴即代码块** — 从 VS Code 等编辑器粘贴代码自动生成带语言高亮的代码块，含 ``` 围栏的纯文本同样识别
- **链接交互** — Ctrl+Click 打开外部链接（类似 VS Code）；悬停链接弹出操作卡，可打开、复制、编辑、取消链接
- **笔记引用 / 双向链接** — 输入 `[[` 选择引用，或正文直接写 `[[标题]]` 文本（含 AI 经 MCP 写入的）都会渲染成可点引用、单击按标题跳转；被引用笔记底部自动显示反向链接（基于稳定 ID，跨设备同步有效）
- **自动保存** — 实时保存，永不丢失

### 🔄 多设备同步

- **mDNS 自动发现** — 同一 WiFi 下自动发现其它打开 Lapis 的设备，无需手输 IP
- **笔记多选同步** — 点设备旁「选笔记」弹模态框，搜索/全选/单选要给对方的笔记，发什么自己说了算
- **跨网 P2P 直连** — 公司↔家不同网络也能加密直连（基于 iroh，NAT 打洞 + relay 兜底）
- **编辑器旁单条同步** — 编辑器头部「推送」按钮把当前笔记直接发给某设备
- **冲突保留双份** — 改同一处自动生成「冲突副本」笔记，绝不静默丢数据
- **首次配对码** — 新设备首次同步时双方各自显示 6 位数字，核对一致才放行，防中间人
- **私有笔记** — 标记为私有的笔记不参与任何同步，只留在本机
- **同步包文件** — 导出/导入同步包，无网络也能经 U 盘搬运笔记
- **设备在线状态** — 跨网设备列表实时显示在线/离线
- **持久设备指纹** — 重启同一台机器在对方眼里仍是同一设备
- **首次启动提示** — Windows 防火墙弹窗时勾选「专用网络」让 mDNS 通过

### 🤖 AI 智能助手

- **多平台支持** — DeepSeek、OpenAI、Anthropic Claude、Google Gemini、Ollama
- **多来源管理** — 同时配置多个 AI 来源，侧边栏快速切换
- **内联改写** — 选中文本 `Ctrl+J` 下指令，AI 就地改写：原文红色删除线保留、新文本流式生成，Tab 接受、Esc 放弃，可重试或追加指令
- **侧边栏对话** — 多对话管理（`Ctrl+L`），自动命名、随时切换；支持粘贴/拖拽图片提问
- **AI 读写笔记** — 对话中 AI 可直接查询、创建、追加你的笔记
- **上下文压缩** — 长对话自动压缩为摘要继续聊，输入卡实时显示上下文占用
- **AI 功能菜单** — 续写、改写、总结、翻译、问答
- **自动标题** — AI 自动生成笔记标题和标签

### 🔗 MCP Server 集成

> 让 AI agent 不只是「读」你的笔记，而是直接「写」进你的本地笔记库 —— 这是 Lapis 区别于多数本地笔记工具的地方。

- **内置 HTTP MCP Server** — Lapis 启动时自动提供服务（`127.0.0.1:19230`）
- **自动注册** — 启动时自动注册到 Claude Code、Cursor、Windsurf 等 9 个 AI 工具
- **6 个工具** — 读取（`get_note`、`search_notes`、`list_notes`）+ 写入（`create_note`、`append_note`、`update_note`）
- **Agent Skill 自动安装** — 启动时自动安装 Agent Skill 到 Claude Code、Copilot、Gemini CLI，AI 工具自动获知使用方法
- **AI 编程工具集成** — 在 Claude Code 中直接说"查看笔记"或"把这段代码保存到笔记"

### 📊 数据概览

- **处处可点的入口面板** — 笔记总数、收藏直达对应视图，点标签进标签视图，点热力图格子直达日历当天
- **写作热力图** — 近 14 周按星期对齐（列为周、行为星期几），颜色越深当天笔记越多
- **待办提醒** — 即将到期的提醒按时间排列、过期标红，点击直达笔记
- **新增趋势** — 7 天 / 30 天切换，悬停查看每日数量
- **24h 时段分布** — 找出你的高产时段
- **Top 5 标签** — 最常用标签的使用频次，配色与侧栏、编辑器一致
- **最近笔记** — 一键点击直接打开对应笔记
- **连续天数** — 当天还没写不断签
- **跟随应用主题** — 浅色/深色自动切换

### 📅 日历

- **月网格** — 每格直接显示当天笔记与提醒，标签自动配色，一眼看到哪天有什么
- **日面板** — 点选任意日期，右侧即时展示当天笔记与提醒，单击直达
- **任意日期记笔记** — 双击格子（或按 Enter）就在那一天新建笔记
- **拖拽改期** — 拖动笔记调整归属日期，拖动提醒改约定时间
- **键盘导航** — 方向键移动日期，PgUp/PgDn 翻月，T 回到今天
- **导出本月** — 当月笔记一键导出为 Markdown / JSON

### 🗂️ 笔记管理

- **智能搜索** — 全局搜索，快速定位（`Ctrl+K`）
- **收藏功能** — 重要笔记一键收藏
- **废纸篓** — 误删笔记可恢复
- **标签系统** — 灵活分类管理，标签自动配色、处处一致
- **提醒功能** — 为笔记设置定时提醒

### 📤 导出分享

- **PDF 导出** — 通过浏览器打印功能导出 PDF
- **Markdown** — 导出为 Markdown 文件

### 🎨 个性化

- **主题切换** — 深色/浅色主题，日夜动画开关
- **自动更新** — 启动时自动检查新版本，发现更新主动弹窗提示
- **更新日志** — 应用内直接查看各版本更新内容

---

## 📥 下载安装

### Windows

从 [Releases](https://github.com/zexadev/lapisnote/releases/latest) 下载最新版本：

| 文件 | 说明 |
|------|------|
| `Lapis_x.x.x_x64-setup.exe` | Windows 安装包（推荐） |
| `Lapis_x.x.x_x64_en-US.msi` | Windows MSI 安装包 |

**系统要求：** Windows 10/11 (64位)

---

## 🚀 快速开始

### 安装步骤

1. 从 [Releases](https://github.com/zexadev/lapisnote/releases/latest) 下载最新安装包
2. 运行安装程序，按提示完成安装
3. 启动 Lapis，开始您的笔记之旅

### 配置 AI 功能

1. 打开设置（点击左下角齿轮图标）
2. 在「AI 设置」中添加 AI 来源
3. 支持 DeepSeek、OpenAI、Anthropic、Google、Ollama 等多个平台

### 使用 MCP Server

Lapis 启动时自动在 `127.0.0.1:19230` 提供 MCP Server，并自动注册到 Claude Code。在 Claude Code 中可以直接说"把这段内容保存到笔记"。

手动注册：
```bash
claude mcp add --transport http lapis http://127.0.0.1:19230/mcp
```

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 全局搜索 |
| `Ctrl+L` | 打开/关闭 AI 侧栏 |
| `Ctrl+J` | 内联提问（选中文本后） |
| `Ctrl+\` | 循环切换侧栏（展开/收起/隐藏） |
| `F11` | 沉浸模式（全屏专注写作） |
| `Ctrl+B` | 粗体 |
| `Ctrl+I` | 斜体 |
| `Ctrl+Shift+C` | 代码块 |
| `Ctrl+Click` | 打开链接 |
| `/` | 斜杠命令菜单 |

---

## 🔧 技术架构

<table>
  <tr>
    <th>层级</th>
    <th>技术</th>
    <th>说明</th>
  </tr>
  <tr>
    <td rowspan="5"><strong>前端</strong></td>
    <td><img src="https://img.shields.io/badge/-React%2019-61DAFB?style=flat-square&logo=react&logoColor=black" /></td>
    <td>用户界面框架</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" /></td>
    <td>类型安全的 JavaScript</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" /></td>
    <td>原子化 CSS 框架</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-TipTap-000000?style=flat-square" /></td>
    <td>富文本编辑器内核</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-Vite%207-646CFF?style=flat-square&logo=vite&logoColor=white" /></td>
    <td>前端构建工具</td>
  </tr>
  <tr>
    <td rowspan="4"><strong>后端</strong></td>
    <td><img src="https://img.shields.io/badge/-Tauri%202-24C8D8?style=flat-square&logo=tauri&logoColor=white" /></td>
    <td>跨平台桌面应用框架</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-Rust-DEA584?style=flat-square&logo=rust&logoColor=black" /></td>
    <td>系统级编程语言</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" /></td>
    <td>轻量级关系数据库</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-MCP-000000?style=flat-square" /></td>
    <td>Model Context Protocol Server</td>
  </tr>
  <tr>
    <td><strong>AI</strong></td>
    <td><img src="https://img.shields.io/badge/-多平台-412991?style=flat-square&logo=openai&logoColor=white" /></td>
    <td>DeepSeek / OpenAI / Claude / Gemini / Ollama</td>
  </tr>
</table>

---

## 💬 反馈支持

如果您在使用中遇到问题或有功能建议：

- 📧 提交 [GitHub Issue](https://github.com/zexadev/lapisnote/issues/new)
- 📖 查看 [文档站](https://jdnotes.zexa.cc)

### 常见问题

<details>
<summary><strong>Q: 我是 jdnotes 老用户，升级会怎样？</strong></summary>
<p>Lapis 就是 jdnotes，2.0 起更名。数据目录不变（<code>%APPDATA%/com.jdnotes.app/</code>），直接安装新版即覆盖升级，笔记、标签、设置全部原样保留。</p>
</details>

<details>
<summary><strong>Q: 数据存储在哪里？</strong></summary>
<p>所有数据存储在本地 SQLite 数据库中，位于 <code>%APPDATA%/com.jdnotes.app/</code> 目录下。可以在设置中修改存储位置。</p>
</details>

<details>
<summary><strong>Q: 支持哪些 AI 平台？</strong></summary>
<p>支持 DeepSeek、OpenAI（及兼容 API）、Anthropic Claude、Google Gemini、Ollama 本地模型。可同时配置多个来源并快速切换。</p>
</details>

<details>
<summary><strong>Q: MCP Server 怎么用？</strong></summary>
<p>启动 Lapis 后会自动在本地提供 MCP Server 并注册到 Claude Code。在 Claude Code 中直接说"保存到笔记"即可使用。</p>
</details>

---

## 📄 许可协议

Lapis **2.0 及以后版本**采用 **[GNU AGPL-3.0-or-later](LICENSE)**（强 copyleft：修改 / 分发、乃至通过网络提供服务，都须以 AGPL 开源其改动）。

附加条款（AGPL §7，见 [NOTICE](NOTICE)）：**修改或分发时，需在你的仓库 README / 源码 / NOTICE 中保留对原作者与本项目的署名**（`Based on Lapis — © 2026 zexadev — https://github.com/zexadev/lapisnote`）并标注你的改动。不要求展示在 app 界面里。

历史版本 **1.9.1 及以前**以 [MIT License](LICENSE-MIT) 发布，仍按 MIT 提供。

Copyright © 2026 [Zexa (zexadev)](https://zexa.cc)

---

## 🙏 致谢

感谢以下开源项目为 Lapis 提供技术支持：

<p>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/-Tauri-24C8D8?style=for-the-badge&logo=tauri&logoColor=white" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" /></a>
  <a href="https://tiptap.dev/"><img src="https://img.shields.io/badge/-TipTap-000000?style=for-the-badge" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/-TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" /></a>
  <a href="https://lucide.dev/"><img src="https://img.shields.io/badge/-Lucide-F56565?style=for-the-badge" /></a>
</p>

---

<p align="center">
  Made with ❤️ by <a href="https://zexa.cc">Zexa</a>
</p>

<p align="center">
  <a href="https://github.com/zexadev/lapisnote">
    ⭐ 如果这个项目对您有帮助，请给一个 Star ⭐
  </a>
</p>
