'use client'

import { MagicCard } from './magic-card'

const features = [
  {
    icon: '🔒',
    title: '本地优先，隐私安全',
    desc: '所有数据存储在本地 SQLite 数据库，不经过云端服务器。断网可用，数据完全由你掌控。',
  },
  {
    icon: '🤖',
    title: 'AI 深度集成',
    desc: '支持 DeepSeek、OpenAI、Claude、Gemini、Ollama。选中文字一键改写，侧栏自由对话，斜杠命令调用 AI 模板。',
  },
  {
    icon: '⚡',
    title: '极致轻量',
    desc: '基于 Tauri 2 + Rust，安装包仅 8MB，启动秒开，内存占用不到 Electron 应用的三分之一。',
  },
  {
    icon: '✏️',
    title: 'Markdown 富文本',
    desc: '基于 TipTap 的所见即所得编辑器，支持 Markdown 快捷输入、代码高亮、表格、待办列表、图片拖拽。',
  },
  {
    icon: '🔗',
    title: 'MCP + Agent Skill',
    desc: '内置 MCP Server，自动注册到 Claude Code、Cursor 等 9 个 AI 工具。AI 可直接查看、搜索、创建笔记。',
  },
  {
    icon: '📅',
    title: '日历与提醒',
    desc: '月/周/日三种日历视图，为笔记设置提醒，到期系统通知，不错过任何重要事项。',
  },
]

const comparisons = [
  { feature: '安装包大小', jd: '8MB', obsidian: '~90MB', siyuan: '~120MB' },
  { feature: 'AI 内置', jd: '多模型，免费', obsidian: '需插件', siyuan: '需订阅' },
  { feature: 'MCP 集成', jd: '内置 6 个工具', obsidian: '需插件', siyuan: '不支持' },
  { feature: '数据存储', jd: '本地 SQLite', obsidian: '本地 Markdown', siyuan: '本地自定义格式' },
  { feature: '双向链接', jd: '不支持', obsidian: '支持', siyuan: '支持' },
  { feature: '开源协议', jd: 'MIT', obsidian: '部分开源', siyuan: 'AGPL' },
]

const blogs = [
  { title: '2026 年本地笔记软件推荐：Obsidian vs 思源 vs JD Notes', href: '/blog/local-note-apps-comparison' },
  { title: '免费 AI 写作工具推荐：本地运行、隐私安全的方案', href: '/blog/free-ai-writing-tools' },
  { title: 'Ollama 本地部署 AI 大模型完整教程', href: '/blog/ollama-local-ai-tutorial' },
  { title: 'Markdown 编辑器推荐 2026：支持 AI 辅助', href: '/blog/markdown-editors-with-ai' },
  { title: 'MCP 是什么？让 Claude Code 操作笔记', href: '/blog/mcp-claude-code-notes' },
  { title: 'Tauri 2 开发实战：构建 AI 桌面笔记应用', href: '/blog/tauri-2-ai-note-app' },
]

export function LandingPage() {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <img src="/app-icon.png" alt="JD Notes" width={88} height={88} className="landing-hero-logo" />
        <h1 className="landing-hero-title">JD Notes</h1>
        <p className="landing-hero-subtitle">
          免费开源的本地笔记应用<br />
          内置 AI 写作助手，数据完全离线，隐私安全
        </p>
        <div className="landing-hero-buttons">
          <a href="https://github.com/zexadev/jdnotes/releases" className="landing-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            下载安装
          </a>
          <a href="/guide" className="landing-btn-secondary">
            使用指南
          </a>
        </div>
        <div className="landing-hero-badges">
          <img src="https://img.shields.io/github/v/release/zexadev/jdnotes?style=flat-square&logo=github" alt="Release" />
          <img src="https://img.shields.io/github/downloads/zexadev/jdnotes/total?style=flat-square&logo=github" alt="Downloads" />
          <img src="https://img.shields.io/github/stars/zexadev/jdnotes?style=flat-square&logo=github" alt="Stars" />
          <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
        </div>
      </section>

      {/* Features with MagicCard */}
      <section className="landing-section">
        <h2 className="landing-section-title">为什么选择 JD Notes？</h2>
        <p className="landing-section-subtitle">专为注重隐私和效率的用户设计</p>
        <div className="landing-features">
          {features.map((f) => (
            <MagicCard
              key={f.title}
              className="landing-magic-card"
              gradientColor="rgba(94, 106, 210, 0.15)"
            >
              <div className="landing-card-inner">
                <div className="landing-card-icon">{f.icon}</div>
                <h3 className="landing-card-title">{f.title}</h3>
                <p className="landing-card-desc">{f.desc}</p>
              </div>
            </MagicCard>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="landing-section">
        <h2 className="landing-section-title">与其他工具对比</h2>
        <p className="landing-section-subtitle">根据需求选择适合你的工具</p>
        <div className="landing-table-wrap">
          <table className="landing-table">
            <thead>
              <tr>
                <th>特性</th>
                <th className="landing-table-highlight">JD Notes</th>
                <th>Obsidian</th>
                <th>思源笔记</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td className="landing-table-highlight">{row.jd}</td>
                  <td>{row.obsidian}</td>
                  <td>{row.siyuan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Blog */}
      <section className="landing-section">
        <h2 className="landing-section-title">博客</h2>
        <div className="landing-blog-grid">
          {blogs.map((b) => (
            <a key={b.href} href={b.href} className="landing-blog-card">
              <span className="landing-blog-arrow">→</span>
              <span>{b.title}</span>
            </a>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <h2 className="landing-cta-title">开始使用 JD Notes</h2>
        <p className="landing-cta-subtitle">免费开源，一键安装，数据完全属于你</p>
        <div className="landing-hero-buttons">
          <a href="https://github.com/zexadev/jdnotes/releases" className="landing-btn-primary">
            下载最新版本
          </a>
          <a href="https://github.com/zexadev/jdnotes" className="landing-btn-secondary">
            GitHub 仓库
          </a>
        </div>
        <p className="landing-cta-footer">
          支持 Windows 10/11 (64位) · MIT License · <a href="https://zexa.cc">Zexa</a> 出品
        </p>
      </section>
    </div>
  )
}
