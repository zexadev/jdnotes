import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// 手机端独立入口：产物出到 dist-mobile，src-tauri/tauri.android.conf.json 的 frontendDist 指向它。
// 与桌面包分开打，APK 不带 Tiptap/CodeMirror/AI 侧栏/日历/概览
export default defineConfig({
  root: 'src/mobile',
  publicDir: '../../public',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../dist-mobile',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
})
