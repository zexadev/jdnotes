package com.jdnotes.app

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File

class MainActivity : TauriActivity() {
  private var webView: WebView? = null
  // 页面报上来的主题（应用内深色是自己的开关，不一定跟系统）；未报之前按系统 uiMode
  private var pageDark: Boolean? = null
  // 交给页面画的上下系统栏高度（CSS px）
  private var insetTopCss = 0f
  private var insetBottomCss = 0f

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // 上下系统栏（状态栏/手势条）不用原生 padding 让位，而是把高度以 CSS 变量交给页面自己留白：
    // 这样那两条区域画的是页面背景，切主题时和页面同一帧变色，不会原生先黑/后黑。
    // 左右刘海和键盘仍用原生 padding（键盘弹出内容区缩高，等价 adjustResize）；
    // 键盘可见时手势条被键盘盖住，页面底部留白归零、由键盘 inset 接管
    val content = findViewById<View>(android.R.id.content)
    val density = resources.displayMetrics.density
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      val imeVisible = ime.bottom > 0
      v.setPadding(bars.left, 0, bars.right, if (imeVisible) ime.bottom else 0)
      insetTopCss = bars.top / density
      insetBottomCss = if (imeVisible) 0f else bars.bottom / density
      pushInsetsToPage()
      WindowInsetsCompat.CONSUMED
    }
    applyTheme()
  }

  // 给页面挂 window.LapisNative：ThemeContext 切主题时调 setDark；页面启动时调 getInsets 拿初始留白
  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    webView.addJavascriptInterface(NativeBridge(), "LapisNative")
  }

  inner class NativeBridge {
    @JavascriptInterface
    fun setDark(dark: Boolean) {
      runOnUiThread {
        pageDark = dark
        applyTheme()
      }
    }

    @JavascriptInterface
    fun getInsets(): String = "{\"top\":$insetTopCss,\"bottom\":$insetBottomCss}"

    // 应用内更新：Rust 把 APK 下到 cacheDir 后，这里经 FileProvider（file_paths.xml 的 cache-path）
    // 签出 content:// URI 交给系统安装器。返回空串=已拉起安装器，否则是错误信息。
    // 首次会被系统要求允许 Lapis「安装未知应用」（manifest 声明了 REQUEST_INSTALL_PACKAGES，
    // 安装器会就地引导）；同签名覆盖安装，数据保留
    @JavascriptInterface
    fun installApk(path: String): String {
      return try {
        val file = File(path)
        if (!file.isFile) return "安装包不存在: $path"
        val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(intent)
        ""
      } catch (e: Exception) {
        e.message ?: e.toString()
      }
    }
  }

  private fun pushInsetsToPage() {
    val js = "document.documentElement.style.setProperty('--safe-area-top','${insetTopCss}px');" +
      "document.documentElement.style.setProperty('--safe-area-bottom','${insetBottomCss}px');"
    webView?.evaluateJavascript(js, null)
  }

  // manifest 的 configChanges 含 uiMode：切深浅色不重建 Activity，这里跟着刷
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyTheme()
  }

  // 状态栏/手势条图标按深浅色反色；窗口背景只在键盘 padding 区露出，仍涂成页面同色兜底
  private fun applyTheme() {
    val systemDark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val dark = pageDark ?: systemDark
    window.decorView.setBackgroundColor(Color.parseColor(if (dark) "#0B0D11" else "#F9FBFC"))
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.isAppearanceLightStatusBars = !dark
    controller.isAppearanceLightNavigationBars = !dark
  }
}
