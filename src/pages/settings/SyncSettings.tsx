import { useState, useEffect } from 'react'
import { Copy, RefreshCw, Loader2, Download, Upload, Trash2, Wifi, Globe, Plus, MonitorSmartphone } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { toast } from '../../lib/toast'

interface SyncSettingsProps {
  onDataChange?: () => void
}

type SyncStats = { sent: number; received: number; inserted: number; updated: number; conflicts: number }

// 已保存的跨网设备（iroh ID 持久不变，所以值得记住，避免每次重填）
type SavedDevice = { id: string; name: string }
const DEVICES_KEY = 'jdnotes_sync_devices'
function loadDevices(): SavedDevice[] {
  try {
    return JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]')
  } catch {
    return []
  }
}

// 同步结果说成人话：突出「发出多少给对方」(对方会更新) + 本机变化 + 方向。
function describeSync(stats: SyncStats): string {
  let local: string
  if (stats.inserted > 0 || stats.updated > 0) {
    local = `本机新增 ${stats.inserted}、更新 ${stats.updated}`
  } else if (stats.received > 0) {
    local = '本机已是最新'
  } else {
    local = '未收到对方数据（对方可能是旧版本或暂无更新）'
  }
  let msg = `已发出 ${stats.sent} 条给对方，对方会更新；${local}`
  if (stats.conflicts > 0) {
    msg += `；${stats.conflicts} 处冲突已存为「冲突副本」笔记，请核对`
  }
  return msg
}

// 同步成功后弹结果：有冲突走 warning，否则 success
function toastSyncResult(prefix: string, stats: SyncStats) {
  const msg = prefix + describeSync(stats)
  if (stats.conflicts > 0) toast.warning(msg, { duration: 7000 })
  else toast.success(msg, { duration: 6000 })
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#5E6AD2]/40 focus:border-[#5E6AD2] outline-none transition-all placeholder:text-gray-400'

const PRIMARY_BTN =
  'px-4 py-2 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 active:scale-[0.98] rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:active:scale-100 shrink-0'

export function SyncSettings({ onDataChange }: SyncSettingsProps) {
  // 本机
  const [deviceName, setDeviceName] = useState('')
  const [irohId, setIrohId] = useState<string | null>(null)
  const [syncInfo, setSyncInfo] = useState<{ address: string } | null>(null)

  // 跨网设备列表
  const [devices, setDevices] = useState<SavedDevice[]>(loadDevices)
  const [newDeviceId, setNewDeviceId] = useState('')
  const [addingDevice, setAddingDevice] = useState(false)
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null)

  // 局域网
  const [peerAddress, setPeerAddress] = useState('')
  const [syncing, setSyncing] = useState(false)

  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => localStorage.getItem('jdnotes_last_sync'))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    invoke<string>('get_device_name').then(setDeviceName).catch(() => {})
    invoke<string>('sync_iroh_get_id').then(setIrohId).catch(() => {})
    invoke<{ address: string }>('sync_get_info').then(setSyncInfo).catch(() => {})
  }, [])

  const markSynced = () => {
    const now = new Date().toISOString()
    localStorage.setItem('jdnotes_last_sync', now)
    setLastSyncAt(now)
  }

  const saveDeviceName = async () => {
    try {
      await invoke('set_device_name', { name: deviceName })
    } catch (e) {
      console.warn('保存设备名失败:', e)
    }
  }

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`已复制${label}`)
  }

  const persistDevices = (list: SavedDevice[]) => {
    setDevices(list)
    localStorage.setItem(DEVICES_KEY, JSON.stringify(list))
  }

  // 添加设备：先 probe 对端验证连通并取回它自己设的设备名（无需手动填名）
  const addDevice = async () => {
    const id = newDeviceId.trim()
    if (!id) return
    if (devices.some((d) => d.id === id)) {
      toast.warning('该设备已在列表中')
      return
    }
    setAddingDevice(true)
    try {
      const name = await invoke<string>('sync_iroh_probe', { peerId: id })
      const finalName = name.trim() || '未命名设备'
      persistDevices([...devices, { id, name: finalName }])
      setNewDeviceId('')
      toast.success(`已连接并添加设备「${finalName}」`)
    } catch (e) {
      toast.error('连接失败：' + (e instanceof Error ? e.message : String(e)) + '（请确认对方已打开应用、ID 正确）', { duration: 7000 })
    }
    setAddingDevice(false)
  }

  const removeDevice = (id: string, name: string) => {
    persistDevices(devices.filter((d) => d.id !== id))
    toast.info(`已移除设备「${name}」`)
  }

  // 跨网：点设备旁的「同步」，用存好的 ID 发起一次双向同步
  const syncDevice = async (device: SavedDevice) => {
    setSyncingDeviceId(device.id)
    try {
      const stats = await invoke<SyncStats>('sync_iroh_connect', { peerId: device.id })
      toastSyncResult(`「${device.name}」`, stats)
      onDataChange?.()
      markSynced()
    } catch (e) {
      toast.error(`「${device.name}」同步失败：` + (e instanceof Error ? e.message : String(e)), { duration: 7000 })
    }
    setSyncingDeviceId(null)
  }

  // 局域网：连接对端做一次双向同步
  const handleLanSync = async () => {
    const addr = peerAddress.trim()
    if (!addr) return
    setSyncing(true)
    try {
      const stats = await invoke<SyncStats>('sync_connect_lan', { address: addr })
      toastSyncResult('', stats)
      onDataChange?.()
      markSynced()
    } catch (e) {
      toast.error('同步失败：' + (e instanceof Error ? e.message : String(e)), { duration: 7000 })
    }
    setSyncing(false)
  }

  const handleExportSync = async () => {
    setBusy(true)
    try {
      const json = await invoke<string>('sync_export_package')
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `jdnotes-sync-${new Date().toISOString().split('T')[0]}.json`,
      })
      if (filePath) {
        await writeTextFile(filePath, json)
        toast.success('同步包已导出')
      }
    } catch (e) {
      toast.error('导出失败：' + (e instanceof Error ? e.message : String(e)))
    }
    setBusy(false)
  }

  const handleImportSync = async () => {
    setBusy(true)
    try {
      const filePath = await openDialog({ filters: [{ name: 'JSON', extensions: ['json'] }], multiple: false })
      if (filePath && typeof filePath === 'string') {
        const json = await readTextFile(filePath)
        const stats = await invoke<{ inserted: number; updated: number; conflicts: number }>('sync_import_package', { jsonData: json })
        const msg = `本机新增 ${stats.inserted}、更新 ${stats.updated}` + (stats.conflicts > 0 ? `；${stats.conflicts} 处冲突已存为冲突副本` : '')
        if (stats.conflicts > 0) toast.warning(msg, { duration: 7000 })
        else toast.success(msg, { duration: 6000 })
        onDataChange?.()
        markSynced()
      }
    } catch (e) {
      toast.error('导入失败：' + (e instanceof Error ? e.message : String(e)))
    }
    setBusy(false)
  }

  const handleGcAttachments = async () => {
    setBusy(true)
    try {
      const r = await invoke<{ removed: number; freed: number }>('sync_gc_attachments')
      const mb = (r.freed / 1024 / 1024).toFixed(1)
      toast.success(r.removed > 0 ? `已清理 ${r.removed} 张无用图片，释放 ${mb} MB` : '没有可清理的图片')
    } catch (e) {
      toast.error('清理失败：' + (e instanceof Error ? e.message : String(e)))
    }
    setBusy(false)
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* 标题 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">设备同步</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          多台设备各持全量笔记、互相同步。
          {lastSyncAt && <span className="text-gray-400 dark:text-gray-500"> · 上次同步 {new Date(lastSyncAt).toLocaleString()}</span>}
        </p>
      </div>

      {/* ① 本机 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-[#5E6AD2]" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">本机</h3>
        </div>

        <div>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            onBlur={saveDeviceName}
            placeholder="给这台设备起个名（如：公司电脑）"
            className={INPUT_CLASS}
          />
          <p className="mt-1.5 text-xs text-gray-400">这个名字会展示给对方、并在同步冲突时标注笔记来源。</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">本机设备 ID</span>
            <span className="text-xs text-gray-400">发给对方添加</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <Globe className="h-4 w-4 text-gray-400 shrink-0" />
            <code className="flex-1 text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
              {irohId ?? '启动中…'}
            </code>
            {irohId && (
              <button
                onClick={() => copy(irohId, '设备 ID')}
                className="shrink-0 p-1.5 text-gray-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-md transition-colors"
                title="复制"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ② 跨网设备 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[#5E6AD2]" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">跨网设备</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
          不同网络（公司↔家）通过加密 P2P 直连。粘贴对方的设备 ID 添加一次即记住，之后一键同步。
        </p>

        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-7 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
            <MonitorSmartphone className="h-6 w-6 text-gray-300 dark:text-gray-600" />
            <p className="text-xs text-gray-400">还没有添加设备</p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div
                key={d.id}
                className="group flex items-center gap-3 px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-[#5E6AD2]/40 hover:shadow-sm transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center shrink-0">
                  <MonitorSmartphone className="h-4 w-4 text-[#5E6AD2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{d.name}</div>
                  <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">{d.id.slice(0, 20)}…</div>
                </div>
                <button
                  onClick={() => syncDevice(d)}
                  disabled={syncingDeviceId !== null}
                  className="px-3 py-1.5 text-xs font-medium text-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40 shrink-0"
                >
                  {syncingDeviceId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  同步
                </button>
                <button
                  onClick={() => removeDevice(d.id, d.name)}
                  title="移除设备"
                  className="shrink-0 p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newDeviceId}
            onChange={(e) => setNewDeviceId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDevice()}
            placeholder="粘贴对方设备 ID，添加时自动获取名称"
            className={INPUT_CLASS}
          />
          <button onClick={addDevice} disabled={addingDevice || !newDeviceId.trim()} className={PRIMARY_BTN}>
            {addingDevice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {addingDevice ? '连接中' : '添加'}
          </button>
        </div>
      </section>

      {/* ③ 局域网快速同步 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-[#5E6AD2]" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">同一网络快速同步</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
          两台在同一 WiFi/网络下，把「本机地址」告诉对方，或输入对方地址直接同步（无需添加设备）。
        </p>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-400 shrink-0">本机地址</span>
          <code className="flex-1 text-sm font-mono text-gray-700 dark:text-gray-300 truncate">{syncInfo?.address ?? '获取中…'}</code>
          {syncInfo && (
            <button
              onClick={() => copy(syncInfo.address, '本机地址')}
              className="shrink-0 p-1.5 text-gray-400 hover:text-[#5E6AD2] hover:bg-[#5E6AD2]/10 rounded-md transition-colors"
              title="复制"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={peerAddress}
            onChange={(e) => setPeerAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLanSync()}
            placeholder="对方地址，如 192.168.1.20:38765"
            className={INPUT_CLASS}
          />
          <button onClick={handleLanSync} disabled={syncing || !peerAddress.trim()} className={PRIMARY_BTN}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            同步
          </button>
        </div>
      </section>

      {/* ④ 其它方式 */}
      <section className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">其它方式</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExportSync}
            disabled={busy}
            className="flex-1 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
          >
            <Download className="h-4 w-4 text-gray-400" /> 导出同步包
          </button>
          <button
            onClick={handleImportSync}
            disabled={busy}
            className="flex-1 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
          >
            <Upload className="h-4 w-4 text-gray-400" /> 导入同步包
          </button>
        </div>
        <button
          onClick={handleGcAttachments}
          disabled={busy}
          className="w-full px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" /> 清理无用图片
        </button>
      </section>
    </div>
  )
}
