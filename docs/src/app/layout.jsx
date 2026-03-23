import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: 'JD Notes',
  description: '简洁高效的本地笔记应用',
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
