// 窄屏下的「返回」栈：打开笔记 / 侧栏抽屉 / AI 全屏层时各 pushState 一层，
// Android 返回手势经 wry 的 webView.goBack() 触发 popstate，这里弹出栈顶回调关掉对应层。
// 界面上的关闭按钮也统一走 closeLayer()（即 history.back()），保证浏览历史层数与界面层数一致，
// 否则手势会多退一层或直接把 App 退到后台。
const handlers: Array<() => void> = []
let installed = false

function install() {
  if (installed) return
  installed = true
  window.addEventListener('popstate', () => {
    const onClose = handlers.pop()
    onClose?.()
  })
}

export function pushLayer(onClose: () => void) {
  install()
  handlers.push(onClose)
  history.pushState({ layer: handlers.length }, '')
}

export function closeLayer() {
  if (handlers.length > 0) history.back()
}
