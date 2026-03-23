<p align="center">
  <img src="./app-icon.png" width="128" height="128" alt="JD Notes Logo">
</p>

<h1 align="center">JD Notes</h1>

<p align="center">
  <strong>简洁高效的本地笔记应用</strong>
</p>

<p align="center">
  <a href="https://github.com/zexadev/jdnotes/releases/latest">
    <img src="https://img.shields.io/github/v/release/zexadev/jdnotes?style=flat-square&logo=github" alt="Latest Release">
  </a>
  <a href="https://github.com/zexadev/jdnotes/releases">
    <img src="https://img.shields.io/github/downloads/zexadev/jdnotes/total?style=flat-square&logo=github" alt="Downloads">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
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
  <a href="https://jdnotes.zexa.cc">文档</a> •
  <a href="#-功能特性">功能特性</a> •
  <a href="#-下载安装">下载安装</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-技术架构">技术架构</a> •
  <a href="#-反馈支持">反馈支持</a>
</p>

---

## 📖 简介

**JD Notes** 是一款基于 Tauri 2 构建的桌面笔记应用，集成 AI 智能助手和 MCP Server，让您的写作更高效。数据本地存储，隐私安全。

| | 特性 | 说明 |
|---|---|---|
| 🚀 | **轻量高效** | 基于 Rust + Web 技术，启动快速，内存占用低 |
| 🔒 | **数据安全** | 本地 SQLite 存储，数据完全掌控在您手中 |
| 🤖 | **AI 赋能** | 多平台 AI 助手，支持 DeepSeek / Claude / Gemini / Ollama |
| 🔗 | **MCP 集成** | 内置 MCP Server，Claude Code 等 AI 工具可直接保存笔记 |
| 🎨 | **界面优雅** | 现代化设计，支持深色/浅色主题动画切换 |

---

## ✨ 功能特性

### 📝 富文本编辑

- **Markdown 支持** — 原生支持 Markdown 语法，所见即所得
- **固定工具栏** — 文本格式、列表、引用、代码块、插入图片等常用操作
- **代码高亮** — 支持 20+ 种编程语言语法高亮
- **图片管理** — 工具栏插入、粘贴、拖拽插入，可缩放和预览大图
- **待办列表** — 支持 `- [ ]` / `- [x]` Markdown 语法，工具栏和斜杠命令快速创建
- **斜杠命令** — 输入 `/` 快速插入各种内容块和 AI 命令
- **链接交互** — Ctrl+Click 打开链接（类似 VS Code）
- **自动保存** — 实时保存，永不丢失

### 🤖 AI 智能助手

- **多平台支持** — DeepSeek、OpenAI、Anthropic Claude、Google Gemini、Ollama
- **多来源管理** — 同时配置多个 AI 来源，侧边栏快速切换
- **侧边栏对话** — 随时与 AI 交流，获取灵感（`Ctrl+L`）
- **内联提问** — 选中文本后 `Ctrl+J` 直接提问
- **AI 功能菜单** — 续写、改写、总结、翻译、问答
- **自动标题** — AI 自动生成笔记标题和标签

### 🔗 MCP Server 集成

- **内置 HTTP MCP Server** — JDNotes 启动时自动提供服务（`127.0.0.1:19230`）
- **自动注册** — 启动时自动注册到 Claude Code，无需手动配置
- **三个工具** — `create_note`（创建）、`append_note`（追加）、`update_note`（修改）
- **AI 编程工具集成** — 在 Claude Code 中直接说"把这段代码保存到笔记"

### 📅 日历视图

- **月视图** — 一览当月笔记分布
- **周视图** — 规划一周工作学习
- **日视图** — 聚焦当日任务

### 🗂️ 笔记管理

- **智能搜索** — 全局搜索，快速定位（`Ctrl+K`）
- **收藏功能** — 重要笔记一键收藏
- **废纸篓** — 误删笔记可恢复
- **标签系统** — 灵活分类管理
- **提醒功能** — 为笔记设置定时提醒

### 📤 导出分享

- **PDF 导出** — 通过浏览器打印功能导出 PDF
- **Markdown** — 导出为 Markdown 文件

### 🎨 个性化

- **主题切换** — 深色/浅色主题，日夜动画开关
- **自动更新** — 应用内检查更新

---

## 📥 下载安装

### Windows

从 [Releases](https://github.com/zexadev/jdnotes/releases/latest) 下载最新版本：

| 文件 | 说明 |
|------|------|
| `jdnotes_x.x.x_x64-setup.exe` | Windows 安装包（推荐） |
| `jdnotes_x.x.x_x64_en-US.msi` | Windows MSI 安装包 |

**系统要求：** Windows 10/11 (64位)

---

## 🚀 快速开始

### 安装步骤

1. 从 [Releases](https://github.com/zexadev/jdnotes/releases/latest) 下载最新安装包
2. 运行安装程序，按提示完成安装
3. 启动 JD Notes，开始您的笔记之旅

### 配置 AI 功能

1. 打开设置（点击左下角齿轮图标）
2. 在「AI 设置」中添加 AI 来源
3. 支持 DeepSeek、OpenAI、Anthropic、Google、Ollama 等多个平台

### 使用 MCP Server

JDNotes 启动时自动在 `127.0.0.1:19230` 提供 MCP Server，并自动注册到 Claude Code。在 Claude Code 中可以直接说"把这段内容保存到笔记"。

手动注册：
```bash
claude mcp add --transport http jdnotes http://127.0.0.1:19230/mcp
```

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 全局搜索 |
| `Ctrl+L` | 打开/关闭 AI 侧栏 |
| `Ctrl+J` | 内联提问（选中文本后） |
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

- 📧 提交 [GitHub Issue](https://github.com/zexadev/jdnotes/issues/new)
- 📖 查看 [文档站](https://jdnotes.zexa.cc)

### 常见问题

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
<p>启动 JDNotes 后会自动在本地提供 MCP Server 并注册到 Claude Code。在 Claude Code 中直接说"保存到笔记"即可使用。</p>
</details>

---

## 📄 许可协议

本项目基于 [MIT License](LICENSE) 开源。

Copyright © 2026 [Zexa](https://zexa.cc)

---

<p align="center">
  Made with ❤️ by <a href="https://zexa.cc">Zexa</a>
</p>

<p align="center">
  <a href="https://github.com/zexadev/jdnotes">
    ⭐ 如果这个项目对您有帮助，请给一个 Star ⭐
  </a>
</p>
