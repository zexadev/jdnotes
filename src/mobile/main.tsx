import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './mobile.css'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { MobileApp } from './App'

// 跟随系统深浅色。桌面主题切换走 ThemeContext + localStorage 手动开关，手机不做开关
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => document.documentElement.classList.toggle('dark', darkQuery.matches)
applyTheme()
darkQuery.addEventListener('change', applyTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MobileApp />
    </ErrorBoundary>
  </StrictMode>,
)
