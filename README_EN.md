<p align="center">
  <img src="./app-icon.png" width="128" height="128" alt="JD Notes Logo">
</p>

<h1 align="center">JD Notes</h1>

<p align="center">
  <strong>thinking is water</strong>
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
  <a href="./README.md">中文</a> •
  <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <a href="https://jdnotes.zexa.cc">Docs</a> •
  <a href="#-features">Features</a> •
  <a href="#-download">Download</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-feedback">Feedback</a>
</p>

---

## About

**JD Notes** is a local-first desktop note-taking app built with Tauri 2, featuring a built-in AI assistant and MCP Server. All data is stored locally on your device — no cloud, no tracking, full privacy.

| | Feature | Description |
|---|---|---|
| :rocket: | **Lightweight** | Built with Rust + Web tech, fast startup, low memory |
| :lock: | **Private** | Local SQLite storage, your data stays on your device |
| :robot: | **AI-Powered** | Multi-provider AI assistant: DeepSeek / Claude / Gemini / Ollama |
| :link: | **MCP Integration** | Built-in MCP Server, works with Claude Code and other AI tools |
| :art: | **Beautiful** | Modern UI with smooth dark/light theme transitions |

---

## Features

### Rich Text Editing

- **Markdown** — Native Markdown support, WYSIWYG editing
- **Toolbar** — Text formatting, lists, quotes, code blocks, images
- **Code Highlighting** — 20+ programming languages with CodeMirror
- **Images** — Insert via toolbar, paste, or drag & drop with resize support
- **Task Lists** — `- [ ]` / `- [x]` syntax, toolbar and slash commands
- **Slash Commands** — Type `/` to quickly insert content blocks and AI commands
- **Links** — Ctrl+Click to open links (VS Code style)
- **Auto Save** — Real-time save, never lose your work

### AI Assistant

- **Multi-Provider** — DeepSeek, OpenAI, Anthropic Claude, Google Gemini, Ollama
- **Multiple Sources** — Configure and switch between AI providers instantly
- **Sidebar Chat** — Chat with AI anytime (`Ctrl+L`)
- **Inline Prompt** — Select text and press `Ctrl+J` to ask AI
- **AI Actions** — Continue writing, rewrite, summarize, translate, Q&A
- **Auto Title** — AI generates note titles and tags automatically

### MCP Server

- **Built-in HTTP MCP Server** — Starts automatically on `127.0.0.1:19230`
- **Auto Registration** — Registers with Claude Code on startup
- **Three Tools** — `create_note`, `append_note`, `update_note`
- **AI Tool Integration** — Say "save this to notes" in Claude Code

### Calendar View

- **Month View** — Overview of notes across the month
- **Week View** — Plan your week
- **Day View** — Focus on today's tasks

### Note Management

- **Global Search** — Find notes instantly (`Ctrl+K`)
- **Favorites** — Star important notes
- **Trash** — Recover deleted notes
- **Tags** — Flexible categorization
- **Reminders** — Set timed reminders for notes

### Export

- **PDF** — Export via browser print
- **Markdown** — Export as `.md` files

### Personalization

- **Themes** — Dark/light mode with animated toggle
- **Auto Update** — In-app update checker

---

## Download

### Windows

Download the latest version from [Releases](https://github.com/zexadev/jdnotes/releases/latest):

| File | Description |
|------|-------------|
| `jdnotes_x.x.x_x64-setup.exe` | Windows Installer (recommended) |
| `jdnotes_x.x.x_x64_en-US.msi` | Windows MSI Installer |

**Requirements:** Windows 10/11 (64-bit)

---

## Quick Start

### Installation

1. Download the latest installer from [Releases](https://github.com/zexadev/jdnotes/releases/latest)
2. Run the installer and follow the prompts
3. Launch JD Notes and start writing

### Configure AI

1. Open Settings (gear icon at bottom-left)
2. Add an AI source in "AI Settings"
3. Supports DeepSeek, OpenAI, Anthropic, Google, Ollama and more

### Using MCP Server

JD Notes automatically starts an MCP Server on `127.0.0.1:19230` and registers with Claude Code. Just say "save this to notes" in Claude Code.

Manual registration:
```bash
claude mcp add --transport http jdnotes http://127.0.0.1:19230/mcp
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Global Search |
| `Ctrl+L` | Toggle AI Sidebar |
| `Ctrl+J` | Inline AI Prompt (with selection) |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+Shift+C` | Code Block |
| `Ctrl+Click` | Open Link |
| `/` | Slash Command Menu |

---

## Tech Stack

<table>
  <tr>
    <th>Layer</th>
    <th>Technology</th>
    <th>Description</th>
  </tr>
  <tr>
    <td rowspan="5"><strong>Frontend</strong></td>
    <td><img src="https://img.shields.io/badge/-React%2019-61DAFB?style=flat-square&logo=react&logoColor=black" /></td>
    <td>UI Framework</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" /></td>
    <td>Type-safe JavaScript</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" /></td>
    <td>Utility-first CSS</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-TipTap-000000?style=flat-square" /></td>
    <td>Rich Text Editor</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-Vite%207-646CFF?style=flat-square&logo=vite&logoColor=white" /></td>
    <td>Build Tool</td>
  </tr>
  <tr>
    <td rowspan="4"><strong>Backend</strong></td>
    <td><img src="https://img.shields.io/badge/-Tauri%202-24C8D8?style=flat-square&logo=tauri&logoColor=white" /></td>
    <td>Desktop App Framework</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-Rust-DEA584?style=flat-square&logo=rust&logoColor=black" /></td>
    <td>Systems Programming</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" /></td>
    <td>Embedded Database</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/-MCP-000000?style=flat-square" /></td>
    <td>Model Context Protocol Server</td>
  </tr>
  <tr>
    <td><strong>AI</strong></td>
    <td><img src="https://img.shields.io/badge/-Multi--Provider-412991?style=flat-square&logo=openai&logoColor=white" /></td>
    <td>DeepSeek / OpenAI / Claude / Gemini / Ollama</td>
  </tr>
</table>

---

## Feedback

If you encounter any issues or have suggestions:

- Submit a [GitHub Issue](https://github.com/zexadev/jdnotes/issues/new)
- Visit the [Documentation](https://jdnotes.zexa.cc)

### FAQ

<details>
<summary><strong>Q: Where is my data stored?</strong></summary>
<p>All data is stored in a local SQLite database at <code>%APPDATA%/com.jdnotes.app/</code>. You can change the storage location in Settings.</p>
</details>

<details>
<summary><strong>Q: Which AI providers are supported?</strong></summary>
<p>DeepSeek, OpenAI (and compatible APIs), Anthropic Claude, Google Gemini, and Ollama for local models. You can configure multiple sources and switch between them.</p>
</details>

<details>
<summary><strong>Q: How does the MCP Server work?</strong></summary>
<p>JD Notes automatically starts a local MCP Server and registers with Claude Code on launch. Just say "save this to notes" in Claude Code to use it.</p>
</details>

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright © 2026 [Zexa](https://zexa.cc)

---

## Acknowledgements

Thanks to these open-source projects:

<p>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/-Tauri-24C8D8?style=for-the-badge&logo=tauri&logoColor=white" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" /></a>
  <a href="https://tiptap.dev/"><img src="https://img.shields.io/badge/-TipTap-000000?style=for-the-badge" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/-TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" /></a>
  <a href="https://lucide.dev/"><img src="https://img.shields.io/badge/-Lucide-F56565?style=for-the-badge" /></a>
</p>

---

<p align="center">
  Made with :heart: by <a href="https://zexa.cc">Zexa</a>
</p>

<p align="center">
  <a href="https://github.com/zexadev/jdnotes">
    If this project helps you, please give it a Star :star:
  </a>
</p>
