import { useEffect, useState } from 'react'
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { derivePairingCode, markPaired } from '../../lib/pairing'

interface PairingCodeModalProps {
  open: boolean
  onClose: () => void
  /** 对端设备名（用于 UI 文案） */
  deviceName: string
  /** 对端 fingerprint（已有） */
  remoteFingerprint: string
  /** 用户确认对得上、已加入白名单后调用，外层接着做实际同步 */
  onConfirmed: () => void
}

/**
 * 首次配对码确认弹窗。
 *
 * 用户点「选笔记」/「同步」时，若对端 fingerprint 还不在白名单，先弹这个：
 *   - 双方屏幕上各自算出同一个 6 位数字
 *   - 用户对上 → 点「一致，建立信任」→ 写入白名单 + 走原本要做的事
 *   - 对不上 → 点「取消」，可能是中间人或选错设备
 *
 * 为什么 6 位数字够：暴力试 100 万种、对端只能从一次连接里学到对/错二元结果，
 * 想猜中而不被发现的概率 = 一百万分之一，且一旦不对人就警觉。够日常用。
 */
export function PairingCodeModal({
  open,
  onClose,
  deviceName,
  remoteFingerprint,
  onConfirmed,
}: PairingCodeModalProps) {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !remoteFingerprint) return
    setCode(null)
    setError(null)
    ;(async () => {
      try {
        // 本机 fp 通过 sync_iroh_get_id 拿到完整公钥再取前 16 字符（与后端 mDNS TXT 派生口径一致）
        const irohId = await invoke<string>('sync_iroh_get_id')
        const localFp = irohId.slice(0, 16)
        const c = await derivePairingCode(localFp, remoteFingerprint)
        setCode(c)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [open, remoteFingerprint])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white dark:bg-dark-sidebar rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-[#5E6AD2]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              首次配对「{deviceName}」
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              确认你们看到同一个数字，防止陌生人冒名顶替
            </p>
          </div>
        </div>

        {/* 6 位码大字展示 */}
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl py-7 my-5 text-center">
          {error ? (
            <div className="flex items-center justify-center gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : code ? (
            <div className="font-mono text-4xl font-bold tracking-[0.4em] text-[#5E6AD2] pl-[0.4em]">
              {code}
            </div>
          ) : (
            <div className="flex items-center justify-center text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
          <p>
            <span className="text-gray-700 dark:text-gray-300 font-medium">在「{deviceName}」上也打开 Lapis</span>，让对方也对你这台机器发起同步。
          </p>
          <p>
            <span className="text-gray-700 dark:text-gray-300 font-medium">两边屏幕上应该看到相同的数字</span>。一致就点下面「一致，建立信任」，之后这两台机器之间就免确认了。
          </p>
          <p className="text-amber-600 dark:text-amber-400">
            数字对不上 → 取消！可能是中间人或选错设备。
          </p>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={async () => {
              // 先写后端权威白名单（接收端/出站鉴权都以它为准），成功后才镜像到前端
              // localStorage 并继续；失败则提示中止，杜绝「前端以为已配对、后端却没有」的分叉
              try {
                await invoke('sync_accept_pairing', { fingerprint: remoteFingerprint })
              } catch (e) {
                setError(`建立信任失败：${e instanceof Error ? e.message : String(e)}`)
                return
              }
              markPaired(remoteFingerprint)
              onConfirmed()
              onClose()
            }}
            disabled={!code || !!error}
            className="px-4 py-2 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            一致，建立信任
          </button>
        </div>
      </div>
    </div>
  )
}
