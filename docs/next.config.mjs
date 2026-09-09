import nextra from 'nextra'
import { readFileSync } from 'node:fs'

// 落地页的大版本号取自根 package.json：发版提交改版本号 → 推送 → Pages 重建，首页自动跟上，
// 不再像 2.0 那样写死在组件里、发了 3.0 首页还挂着 2.0
const appVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

const withNextra = nextra({
  search: {
    codeblocks: false,
  },
})

export default withNextra({
  output: 'export',
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
})
