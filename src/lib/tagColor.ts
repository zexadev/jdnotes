// 标签颜色：按标签名哈希到固定调色盘，同一标签在侧栏/编辑器/任何位置颜色恒定，
// 无需存储、跨设备一致。色值取中等明度（500 档），亮暗主题下都可读。

const PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#10b981', // emerald
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
]

export interface TagColor {
  /** 主色（图标、文字、圆点） */
  base: string
  /** 12% 透明底（chip 背景） */
  bg: string
  /** 25% 透明描边 */
  border: string
}

export function tagColor(tag: string): TagColor {
  // djb2 哈希，对中文（多字节码点）同样稳定
  let h = 5381
  for (let i = 0; i < tag.length; i++) {
    h = ((h << 5) + h + tag.charCodeAt(i)) | 0
  }
  const base = PALETTE[Math.abs(h) % PALETTE.length]
  return { base, bg: `${base}1f`, border: `${base}40` }
}
