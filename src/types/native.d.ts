// Android MainActivity 经 addJavascriptInterface 挂上的桥；桌面 WebView2 / 浏览器里不存在
interface Window {
  LapisNative?: {
    /** 把应用内主题报给原生：状态栏/手势条底色与图标反色只能原生涂 */
    setDark(dark: boolean): void
  }
}
