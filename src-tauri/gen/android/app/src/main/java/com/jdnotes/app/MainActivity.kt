package com.jdnotes.app

import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // 系统栏 / 刘海 / 键盘的 inset 全部转成内容区 padding：Android WebView 不把系统栏 inset 暴露成
    // CSS env(safe-area-inset-*)，页面侧拿不到；键盘弹出时内容区随之缩高（等价 adjustResize），
    // 输入框不会被键盘盖住。padding 加在 android.R.id.content 上而不是 WebView 本身——WebView 不认 padding
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
      WindowInsetsCompat.CONSUMED
    }
    applyTheme()
  }

  // manifest 的 configChanges 含 uiMode：切深浅色不重建 Activity，这里跟着刷
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyTheme()
  }

  // padding 让出来的状态栏/手势条区域露的是窗口背景，涂成和页面同色（index.css 的 water-bg / dark-bg），
  // 状态栏图标按深浅色反色
  private fun applyTheme() {
    val dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    window.decorView.setBackgroundColor(Color.parseColor(if (dark) "#0B0D11" else "#F9FBFC"))
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.isAppearanceLightStatusBars = !dark
    controller.isAppearanceLightNavigationBars = !dark
  }
}
