---
description: Save content to JD Notes app via MCP / 通过 MCP 将内容保存到 JD Notes
user-invocable: true
---

# JD Notes MCP

JD Notes 提供本地 MCP Server，可将内容直接保存到笔记应用。

## 前提

- JDNotes 应用必须正在运行
- 已注册 MCP Server：`claude mcp add --transport http jdnotes http://127.0.0.1:19230/mcp`

## 可用工具

### create_note
创建新笔记。
- `title` (string, 必填): 笔记标题
- `content` (string, 必填): 笔记内容，支持 Markdown
- `tags` (string[], 可选): 标签列表

### append_note
按标题模糊匹配已有笔记，追加内容。
- `title` (string, 必填): 要匹配的笔记标题
- `content` (string, 必填): 要追加的内容

## 使用示例

保存代码片段：
```
create_note(title: "API 接口设计", content: "## POST /api/users\n...", tags: ["backend", "api"])
```

追加到开发日志：
```
append_note(title: "开发日志", content: "### 2026-03-23\n- 完成了 MCP 集成")
```
