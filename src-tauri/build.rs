fn main() {
  // 前端产物是 tauri::generate_context! 在编译期读进二进制的，tauri_build::build() 只登记了
  // tauri.conf.json 和 capabilities；只改前端重新 pnpm build 后 cargo 不会重编 app crate，
  // 桌面 exe / Android .so 里嵌的还是旧页面（实测过：dist 已更新而两个产物都没有新文案）。
  // 显式登记 dist 目录，cargo 会递归扫描其中文件的修改
  println!("cargo:rerun-if-changed=../dist");
  tauri_build::build()
}
