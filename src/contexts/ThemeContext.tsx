import { createContext, useContext, useEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  // origin：切换动画的扩散原点（主题开关传自己的中心 → 圆形揭示；缺省 → 整页交叉淡化）
  toggleTheme: (origin?: { x: number; y: number }) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'jdnotes-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      return stored || 'system'
    }
    return 'system'
  })

  // 跟踪系统主题；resolvedTheme 由 theme+systemTheme 派生，不再用 effect 同步 state
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setSystemTheme(getSystemTheme())
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme

  // 应用主题到 HTML 元素。
  // 切换用 View Transitions：主题开关传入原点 → 从开关中心圆形揭示新主题；
  // 无原点（命令面板等）→ 整页交叉淡化。两种都以整页快照统一变色——
  // 散落各处的 transition-colors 时长不一，逐元素各自变色会显得零碎，
  // 故切换瞬间加 theme-switching 禁掉全部元素级过渡。首次挂载不做动画。
  const firstApplyRef = useRef(true)
  const pendingOriginRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const root = document.documentElement
    const isChange = root.classList.contains('dark') !== (resolvedTheme === 'dark')
    const origin = pendingOriginRef.current
    pendingOriginRef.current = null

    const apply = () => {
      root.classList.add('theme-switching')
      if (resolvedTheme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => root.classList.remove('theme-switching'))
      })
    }

    const startViewTransition = (
      document as Document & {
        startViewTransition?: (cb: () => void) => { ready?: Promise<void>; finished?: Promise<void> }
      }
    ).startViewTransition?.bind(document)

    if (firstApplyRef.current || !isChange || !startViewTransition) {
      apply()
      firstApplyRef.current = false
      return
    }
    firstApplyRef.current = false

    if (origin) {
      // 圆形揭示：新主题快照以 clip-path 圆从原点扩散铺满（data-theme-vt 关掉默认交叉淡化）
      const { x, y } = origin
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
      root.dataset.themeVt = 'circle'
      const cleanup = () => { delete root.dataset.themeVt }
      const transition = startViewTransition(apply)
      transition.finished?.finally?.(cleanup)
      transition.ready
        ?.then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`] },
            { duration: 700, easing: 'ease-in-out', fill: 'forwards', pseudoElement: '::view-transition-new(root)' }
          )
        })
        .catch(cleanup)
    } else {
      startViewTransition(apply)
    }
  }, [resolvedTheme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  const toggleTheme = (origin?: { x: number; y: number }) => {
    pendingOriginRef.current = origin ?? null
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
