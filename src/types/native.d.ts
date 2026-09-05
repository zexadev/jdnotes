// Android MainActivity 经 addJavascriptInterface 挂上的桥；桌面 WebView2 / 浏览器里不存在
interface Window {
  LapisNative?: {
    /** 把应用内主题报给原生：状态栏/手势条图标反色只能原生做 */
    setDark(dark: boolean): void
    /** 状态栏/手势条高度（CSS px）的 JSON 串 {"top":..,"bottom":..}，页面自己留白、自己画背景 */
    getInsets(): string
    /** 把 Rust 下好的 APK（绝对路径，须在应用 cacheDir 下）交给系统安装器；返回空串=已拉起，否则是错误信息 */
    installApk(path: string): string
  }
}
