import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'JD Notes — 简洁高效的本地笔记应用',
    template: '%s — JD Notes',
  },
  description: 'JD Notes 是一款基于 Tauri + React 的本地笔记应用，内置 AI 助手，支持 Markdown 富文本编辑、多模型 AI 对话、日历提醒、MCP 工具集成，数据完全存储在本地。',
  keywords: ['笔记应用', '本地笔记', 'Tauri', 'AI助手', 'Markdown', '离线笔记', 'JD Notes', '桌面应用', 'Windows笔记'],
  metadataBase: new URL('https://jdnotes.zexa.cc'),
  openGraph: {
    title: 'JD Notes — 简洁高效的本地笔记应用',
    description: '基于 Tauri + React 的本地笔记应用，内置 AI 助手，支持 Markdown 编辑、多模型对话、日历提醒。',
    url: 'https://jdnotes.zexa.cc',
    siteName: 'JD Notes',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary',
    title: 'JD Notes — 简洁高效的本地笔记应用',
    description: '基于 Tauri + React 的本地笔记应用，内置 AI 助手，数据完全存储在本地。',
  },
  alternates: {
    canonical: 'https://jdnotes.zexa.cc',
  },
}

const navbar = (
  <Navbar
    logo={<b>JD Notes</b>}
    projectLink="https://github.com/zexadev/jdnotes"
  />
)

const footer = <Footer>MIT {new Date().getFullYear()} © JD Notes.</Footer>

export default async function RootLayout({ children }) {
  return (
    <html lang="zh-CN" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/zexadev/jdnotes/tree/main/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
