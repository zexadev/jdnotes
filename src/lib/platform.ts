import { useEffect, useState } from 'react'

// Tauri 移动端（Android/iOS）：窗口 API、updater/process/单实例插件都不存在，
// asset:// 在 Android WebView 上有未修的 500（tauri#12364）。按平台而非视口宽判断
export const isMobilePlatform = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const NARROW_QUERY = '(max-width: 767px)'

// 窄屏布局开关：三栏改堆叠、侧栏改抽屉、AI 侧栏改全屏层。
// 按视口宽而非平台判断——与 Tailwind 的 md 断点同一条线，桌面缩窗口也能验
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}
