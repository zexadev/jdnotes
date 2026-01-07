<p align="center">
  <img src="./app-icon.png" width="128" height="128" alt="JD Notes Logo">
</p>

<h1 align="center">JD Notes</h1>

<p align="center">
  <strong>一款简洁强大的智能笔记应用</strong>
</p>

<p align="center">
  <a href="https://github.com/huancheng01/jdnotes/releases/latest">
    <img src="https://img.shields.io/github/v/release/huancheng01/jdnotes?style=flat-square&logo=github" alt="Latest Release">
  </a>
  <a href="https://github.com/huancheng01/jdnotes/releases">
    <img src="https://img.shields.io/github/downloads/huancheng01/jdnotes/total?style=flat-square&logo=github" alt="Downloads">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=flat-square" alt="License">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.9-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-1.77-DEA584?style=flat-square&logo=rust&logoColor=black" alt="Rust">
  <img src="https://img.shields.io/badge/TailwindCSS-4.1-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite">
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-下载安装">下载安装</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-技术架构">技术架构</a> •
  <a href="#-路线图">路线图</a> •
  <a href="#-反馈支持">反馈支持</a>
</p>

---

## 📖 简介

**JD Notes** 是一款基于 Tauri 2 构建的跨平台桌面笔记应用，集成了 AI 智能助手，让您的写作更高效、更智能。无论是日常记录、知识管理还是创意写作，JD Notes 都能满足您的需求。

### 为什么选择 JD Notes？

| | 特性 | 说明 |
|---|---|---|
| 🚀 | **轻量高效** | 基于 Rust + Web 技术，启动快速，内存占用低 |
| 🔒 | **数据安全** | 本地 SQLite 存储，数据完全掌控在您手中 |
| 🤖 | **AI 赋能** | 内置智能助手，助力创作与整理 |
| 🎨 | **界面优雅** | 现代化设计，支持深色/浅色主题 |
| 📱 | **跨平台** | 支持 Windows，macOS 和 Linux 即将推出 |

---

## ✨ 功能特性

### 📝 富文本编辑

- **Markdown 支持** - 原生支持 Markdown 语法，所见即所得
- **代码高亮** - 支持 20+ 种编程语言语法高亮
- **图片管理** - 拖拽或粘贴图片，支持大小调整
- **斜杠命令** - 输入 `/` 快速插入各种内容块
- **自动保存** - 实时保存，永不丢失

### 🤖 AI 智能助手

- **侧边栏对话** - 随时与 AI 交流，获取灵感
- **右键菜单** - 选中文本即可调用 AI 功能
  - ✍️ 续写内容
  - 🔄 改写润色
  - 📝 总结要点
  - 🌐 多语言翻译
  - ❓ 智能问答
- **自动标题** - AI 自动生成笔记标题和标签

### 📅 日历视图

- **月视图** - 一览当月笔记分布
- **周视图** - 规划一周工作学习
- **日视图** - 聚焦当日任务

### 🗂️ 笔记管理

- **智能搜索** - 全局搜索，快速定位 (`Ctrl+K`)
- **收藏功能** - 重要笔记一键收藏
- **废纸篓** - 误删笔记可恢复
- **标签系统** - 灵活分类管理
- **提醒功能** - 为笔记设置定时提醒，支持快捷时间选择

### 📤 导出分享

- **PDF 导出** - 通过浏览器打印功能导出 PDF
- **Markdown** - 导出为 Markdown 文件

### 🎨 个性化

- **主题切换** - 深色/浅色主题自由切换
- **界面定制** - 简洁直观的设置面板
- **自动更新** - 应用内检查更新

---

## 📥 下载安装

### Windows

从 [Releases](https://github.com/huancheng01/jdnotes/releases/latest) 下载最新版本：

| 文件 | 说明 |
|------|------|
| `jdnotes_x.x.x_x64-setup.exe` | Windows 安装包（推荐） |
| `jdnotes_x.x.x_x64_en-US.msi` | Windows MSI 安装包 |

**系统要求：** Windows 10/11 (64位)

---

## 🚀 快速开始

### 安装步骤

1. 从 [Releases](https://github.com/huancheng01/jdnotes/releases/latest) 下载最新安装包
2. 运行安装程序，按提示完成安装
3. 启动 JD Notes，开始您的笔记之旅

### 配置 AI 功能

1. 打开设置（点击左下角齿轮图标）
2. 在「AI 设置」中填入 API Key
3. 支持 OpenAI 及兼容 API 接口

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 全局搜索 |
| `Ctrl+J` | AI 助手侧栏 |
| `/` | 斜杠命令菜单（编辑模式下） |

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
    <td rowspan="3"><strong>后端</strong></td>
    <td><img src="https://img.shields.io/badge/-Tauri%202.9-24C8D8?style=flat-square&logo=tauri&logoColor=white" /></td>
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
    <td><strong>AI</strong></td>
    <td><img src="https://img.shields.io/badge/-OpenAI%20API-412991?style=flat-square&logo=openai&logoColor=white" /></td>
    <td>GPT 系列大语言模型</td>
  </tr>
</table>

---

## 📋 路线图

### 已完成 ✅

- [x] 基础笔记管理功能
- [x] TipTap 富文本编辑器
- [x] AI 智能助手（对话、续写、改写、总结、翻译）
- [x] 日历视图（月/周/日）
- [x] 深色/浅色主题
- [x] 应用内自动更新
- [x] 全局搜索
- [x] 笔记导出（PDF、Markdown）
- [x] 笔记提醒功能
- [x] AI 智能标签推荐

### 计划中 🚧


- [ ] 移动端应用
- [ ] 更多 AI 功能支持
- [ ] 笔记模板系统

---

## 💬 反馈支持

### 问题反馈

如果您在使用中遇到问题或有功能建议，欢迎通过以下方式反馈：

- 📧 提交 [GitHub Issue](https://github.com/huancheng01/jdnotes/issues/new)
- 💬 在 Release 页面留言

### 常见问题

<details>
<summary><strong>Q: 数据存储在哪里？</strong></summary>
<p>所有数据存储在本地 SQLite 数据库中，位于 <code>%APPDATA%/jdnotes/</code> 目录下。也可以在设置中修改存储位置</p>
</details>

<details>
<summary><strong>Q: 如何配置 AI 功能？</strong></summary>
<p>打开设置 → AI 设置，填入您的 OpenAI API Key 或兼容 API 的地址和密钥即可。</p>
</details>

<details>
<summary><strong>Q: 支持哪些 AI 模型？</strong></summary>
<p>支持 OpenAI GPT 系列模型，以及所有兼容 OpenAI API 格式的服务（如 Azure OpenAI、本地部署的模型等）。</p>
</details>

---

## 📄 许可协议

Copyright © 2024-2026 [huancheng01](https://github.com/huancheng01). All Rights Reserved.

本软件为专有软件，未经作者书面授权，禁止以下行为：
- 复制、修改、分发本软件的源代码
- 对本软件进行反编译、反汇编或逆向工程
- 将本软件用于商业目的

个人用户可免费下载并使用本软件的发布版本。

---

## 🙏 致谢

感谢以下开源项目为 JD Notes 提供技术支持：

<p>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/-Tauri-24C8D8?style=for-the-badge&logo=tauri&logoColor=white" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" /></a>
  <a href="https://tiptap.dev/"><img src="https://img.shields.io/badge/-TipTap-000000?style=for-the-badge" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/-TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" /></a>
  <a href="https://lucide.dev/"><img src="https://img.shields.io/badge/-Lucide-F56565?style=for-the-badge" /></a>
</p>

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/huancheng01">huancheng01</a>
</p>

<p align="center">
  <a href="https://github.com/huancheng01/jdnotes">
    ⭐ 如果这个项目对您有帮助，请给一个 Star ⭐
  </a>
</p>
