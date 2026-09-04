import { invoke } from '@tauri-apps/api/core'

// attachment://<hash>?w=<宽> → data URL。手机不走 asset:// 协议（Android WebView 上有未修的 500，tauri#12364），
// 直接让 Rust 读文件回 base64；同一 hash 只解一次
const cache = new Map<string, Promise<string | null>>()

export function parseAttachmentHash(src: string): string | null {
  if (!src.startsWith('attachment://')) return null
  const rest = src.slice('attachment://'.length)
  const q = rest.indexOf('?')
  return q === -1 ? rest : rest.slice(0, q)
}

export function resolveAttachment(hash: string): Promise<string | null> {
  let pending = cache.get(hash)
  if (!pending) {
    pending = invoke<string | null>('read_attachment_data_url', { hash }).catch(() => null)
    cache.set(hash, pending)
  }
  return pending
}
