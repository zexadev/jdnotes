/**
 * 设备配对码：在双方各自的本地用相同算法从两边 fingerprint 推导出 6 位数字。
 *
 * 设计要点（防中间人）：
 * - 输入是双方 fingerprint 的有序拼接（min + max），保证两端算出来一样
 * - 不靠网络协商，纯本地计算 —— 中间人无法伪造一致的码
 * - 用 SHA-256 取前 4 字节大端 mod 1_000_000，得 0..999_999 之间均匀分布
 *
 * UX：用户在两台设备屏幕上对一下码，一致再点「同意」加入白名单（之后免确认）。
 * 白名单按 fingerprint 持久化在 localStorage。
 */

const PAIRED_DEVICES_KEY = 'jdnotes_paired_devices'

/** 双方 fingerprint 推导 6 位配对码 */
export async function derivePairingCode(localFp: string, remoteFp: string): Promise<string> {
  const a = localFp.trim()
  const b = remoteFp.trim()
  if (!a || !b) throw new Error('缺少设备指纹')
  const [lo, hi] = a < b ? [a, b] : [b, a]
  const data = new TextEncoder().encode(`${lo}|${hi}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const view = new DataView(hash)
  // 取前 4 字节大端 mod 1_000_000，得 6 位（不足前导补 0）
  const num = view.getUint32(0, false) % 1_000_000
  return num.toString().padStart(6, '0')
}

/** 配对白名单：是否已确认过这个 fingerprint */
export function isPaired(fingerprint: string): boolean {
  if (!fingerprint) return false
  try {
    const list = JSON.parse(localStorage.getItem(PAIRED_DEVICES_KEY) || '[]') as string[]
    return list.includes(fingerprint)
  } catch {
    return false
  }
}

/** 加入配对白名单 */
export function markPaired(fingerprint: string) {
  if (!fingerprint) return
  try {
    const list = JSON.parse(localStorage.getItem(PAIRED_DEVICES_KEY) || '[]') as string[]
    if (!list.includes(fingerprint)) {
      list.push(fingerprint)
      localStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(list))
    }
  } catch {
    localStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify([fingerprint]))
  }
}

/** 从白名单移除（用户主动取消信任时用） */
export function unmarkPaired(fingerprint: string) {
  try {
    const list = JSON.parse(localStorage.getItem(PAIRED_DEVICES_KEY) || '[]') as string[]
    const next = list.filter((fp) => fp !== fingerprint)
    localStorage.setItem(PAIRED_DEVICES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}
