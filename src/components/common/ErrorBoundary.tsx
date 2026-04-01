import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[#F9FBFC] dark:bg-[#0B0D11]">
          <div className="text-center max-w-md px-6">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              页面出现异常
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {this.state.error?.message || '未知错误'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRecover}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] rounded-lg transition-colors"
              >
                尝试恢复
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 text-sm text-white bg-[#5E6AD2] hover:bg-[#4F5ABF] rounded-lg transition-colors"
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
