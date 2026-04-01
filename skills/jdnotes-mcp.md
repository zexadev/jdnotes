---
description: Read and write notes in JD Notes app via MCP / 通过 MCP 读写 JD Notes 笔记
user-invocable: true
---

# JD Notes MCP

JD Notes 提供本地 MCP Server，可读取和写入笔记。

## 前提

- JDNotes 应用必须正在运行
- 已注册 MCP Server：`claude mcp add --transport http jdnotes http://127.0.0.1:19230/mcp`

## 可用工具

### 写入

#### create_note
创建新笔记。
- `title` (string, 必填): 笔记标题
- `content` (string, 必填): 笔记内容，支持 Markdown
- `tags` (string[], 可选): 标签列表

#### append_note
按标题模糊匹配已有笔记，追加内容。
- `title` (string, 必填): 要匹配的笔记标题
- `content` (string, 必填): 要追加的内容

#### update_note
按标题模糊匹配已有笔记，修改标题、内容或标签。
- `title` (string, 必填): 要匹配的笔记标题
- `new_title` (string, 可选): 新标题
- `new_content` (string, 可选): 新内容（完全替换）
- `new_tags` (string[], 可选): 新标签列表（完全替换）

### 读取

#### get_note
按标题模糊匹配，查看笔记完整内容。
- `title` (string, 必填): 要查找的笔记标题

#### search_notes
按关键词搜索笔记（匹配标题和内容）。
- `query` (string, 必填): 搜索关键词

#### list_notes
列出所有笔记标题。
- `limit` (number, 可选): 返回数量限制，默认 50
