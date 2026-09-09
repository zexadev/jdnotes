import { useEffect, useState } from 'react'

// Tauri 移动端（Android/iOS）：窗口 API、updater/process/单实例插件都不存在，
// asset:// 在 Android WebView 上有未修的 500（tauri#12364）。按平台而非视口宽判断
export const isMobilePlatform = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
export const isAndroidPlatform = /Android/i.test(navigator.userAgent)
// iPadOS 的 WKWebView 可能报 Macintosh UA，靠多点触控兜底
export const isIOSPlatform =
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

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

// Android 上状态栏/手势条区域由页面自己留白、自己画背景（切主题时才能和页面同帧变色），
// 高度由 MainActivity 经 window.LapisNative 给出；启动时读一次，之后原生在 inset 变化时直接写 CSS 变量
export function initNativeInsets() {
  if (isIOSPlatform) {
    initIOSKeyboardInset()
    return
  }
  const raw = window.LapisNative?.getInsets?.()
  if (!raw) return
  try {
    const { top, bottom } = JSON.parse(raw) as { top: number; bottom: number }
    const style = document.documentElement.style
    style.setProperty('--safe-area-top', `${top}px`)
    style.setProperty('--safe-area-bottom', `${bottom}px`)
  } catch {
    // 桥返回了非 JSON：当没有留白处理
  }
}

// iOS 的 WKWebView 弹键盘时布局视口不缩、只有 visualViewport 变矮，fixed 在底部的工具栏会被键盘盖住。
// 把键盘高度写进 --safe-area-bottom（Android 是原生 padding 让位后把它归零，这里反过来把它撑高），
// 根容器的底部留白随之变大，等价 adjustResize；键盘收起后清掉行内值，回到 CSS 里的 env() 默认
function initIOSKeyboardInset() {
  const vv = window.visualViewport
  if (!vv) return
  const style = document.documentElement.style
  const apply = () => {
    const keyboard = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    if (keyboard > 0) style.setProperty('--safe-area-bottom', keyboard + 'px')
    else style.removeProperty('--safe-area-bottom')
  }
  vv.addEventListener('resize', apply)
  vv.addEventListener('scroll', apply)
}
