import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'JD Notes — 简洁高效的本地笔记应用',
    template: '%s — JD Notes',
  },
  description: 'JD Notes 是一款免费开源的 Windows 本地笔记软件，内置 AI 写作助手，支持 Markdown 富文本编辑、多模型 AI 对话（OpenAI/Claude/Gemini/Ollama）、日历提醒、代码高亮，数据完全离线存储，保护隐私安全。',
  keywords: ['JD Notes', '笔记应用', '本地笔记', '免费笔记软件', 'Windows笔记软件', 'AI写作助手', 'AI笔记应用', 'Markdown编辑器', '离线笔记工具', '开源笔记应用', 'Tauri桌面应用', '本地存储笔记', '隐私安全笔记', '代码高亮笔记', 'MCP工具集成'],
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
  icons: {
    icon: '/favicon.ico',
    apple: '/app-icon.png',
  },
}

const navbar = (
  <Navbar
    logo={
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/app-icon.png" alt="JD Notes" width={24} height={24} />
        <b>JD Notes</b>
      </span>
    }
    projectLink="https://github.com/zexadev/jdnotes"
  />
)

const footer = <Footer>MIT {new Date().getFullYear()} © JD Notes.</Footer>

// JSON-LD 结构化数据
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://jdnotes.zexa.cc/#website',
      url: 'https://jdnotes.zexa.cc',
      name: 'JD Notes',
      description: '简洁高效的本地笔记应用，内置 AI 写作助手',
      inLanguage: 'zh-CN',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://jdnotes.zexa.cc/#app',
      name: 'JD Notes',
      description: '免费开源的 Windows 本地笔记软件，内置 AI 写作助手，支持 Markdown 编辑、多模型 AI 对话、日历提醒，数据完全离线存储。',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Windows 10/11',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'CNY',
      },
      downloadUrl: 'https://github.com/zexadev/jdnotes/releases',
      softwareVersion: '1.6.4',
      author: {
        '@type': 'Organization',
        name: 'Zexa',
        url: 'https://zexa.cc',
      },
      aggregateRating: undefined,
    },
    {
      '@type': 'Organization',
      '@id': 'https://jdnotes.zexa.cc/#org',
      name: 'Zexa',
      url: 'https://zexa.cc',
    },
  ],
}

export default async function RootLayout({ children }) {
  return (
    <html lang="zh-CN" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
