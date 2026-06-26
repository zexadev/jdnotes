import { useState, useEffect } from 'react'
import { Copy, RefreshCw, Loader2, Download, Upload, Trash2, Wifi, Globe, Plus, MonitorSmartphone, Send } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { toast } from '../../lib/toast'
import { isPaired } from '../../lib/pairing'
import { NoteSelectModal } from '../../components/modals/NoteSelectModal'
import { PairingCodeModal } from '../../components/modals/PairingCodeModal'

interface SyncSettingsProps {
  onDataChange?: () => void
}

type SyncStats = { sent: number; received: number; inserted: number; updated: number; conflicts: number; conn_type?: string | null }

// 已保存的跨网设备（iroh ID 持久不变，所以值得记住，避免每次重填）
// kind：'mine' = 我的设备（可全量双向同步）；'shared' = 分享对象（只能选笔记发）。
// 旧数据无此字段，按 'mine' 处理（向后兼容，行为不变）。
type DeviceKind = 'mine' | 'shared'
type SavedDevice = { id: string; name: string; kind?: DeviceKind }
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
  // 跨网连接类型(iroh)：直连 P2P / 经 relay 中转;局域网无此字段不显示
  if (stats.conn_type === 'direct') msg += ' · ⚡ P2P 直连'
  else if (stats.conn_type === 'relay') msg += ' · 🔁 经中转'
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
  // 添加设备时选的类型：我的设备（全量同步）/ 分享对象（只选笔记发）
  const [newDeviceKind, setNewDeviceKind] = useState<DeviceKind>('mine')
  const [addingDevice, setAddingDevice] = useState(false)
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null)
  const [deviceStatus, setDeviceStatus] = useState<Record<string, 'checking' | 'online' | 'offline'>>({})
  // 每台设备「上次同步」的连接方式（direct/relay），持久化后显示在设备卡上。
  // 取自实际同步（连接已稳定）而非 probe（probe 太快通常还在 relay 阶段，会误报中转）。
  const [connTypes, setConnTypes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('jdnotes_conn_types') || '{}')
    } catch {
      return {}
    }
  })
  const recordConnType = (id: string, t?: string | null) => {
    if (t !== 'direct' && t !== 'relay') return
    setConnTypes((prev) => {
      const next = { ...prev, [id]: t }
      localStorage.setItem('jdnotes_conn_types', JSON.stringify(next))
      return next
    })
  }

  // 局域网
  const [peerAddress, setPeerAddress] = useState('')
  // mDNS 发现的同网段设备
  const [discovered, setDiscovered] = useState<{ address: string; device_name: string; fingerprint?: string; protocol?: string }[]>([])
  const [discovering, setDiscovering] = useState(false)
  // 选笔记同步弹窗目标（null 表示未打开）
  const [noteSelectTarget, setNoteSelectTarget] = useState<{ address: string; deviceName: string; fingerprint?: string; peerId?: string } | null>(null)
  // 首次配对码弹窗目标（null 表示未打开）；确认后按 kind 决定接着做什么：
  // lan→选笔记(局域网)；iroh-full→全量同步(我的设备)；iroh-select→选笔记(跨网分享对象)
  const [pairingTarget, setPairingTarget] = useState<
    | { kind: 'lan'; address: string; deviceName: string; fingerprint: string }
    | { kind: 'iroh-full'; device: SavedDevice; fingerprint: string }
    | { kind: 'iroh-select'; device: SavedDevice; fingerprint: string }
    | null
  >(null)

  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => localStorage.getItem('jdnotes_last_sync'))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    invoke<string>('get_device_name').then(setDeviceName).catch(() => {})
    invoke<string>('sync_iroh_get_id').then(setIrohId).catch(() => {})
    invoke<{ address: string }>('sync_get_info').then(setSyncInfo).catch(() => {})
    // 进页面探测各设备在线状态
    devices.forEach((d) => checkDevice(d.id))
    // 迁移：把已有 localStorage 设备类型同步到后端权威白名单（旧数据无 kind=按 mine）。
    // 已配对的「我的设备」补登记成 mine，避免升级后全量同步被新的后端闸拦下。
    devices.forEach((d) => setBackendKind(d.id.slice(0, 16), (d.kind ?? 'mine') === 'mine'))
    // 进页面自动搜索局域网邻居（mDNS，约 1.5s）
    handleDiscoverLan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 探测设备是否在线：复用 probe，8s 没连上算离线
  const checkDevice = async (id: string) => {
    setDeviceStatus((s) => ({ ...s, [id]: 'checking' }))
    try {
      const res = await Promise.race([
        invoke<{ device_name: string; conn_type?: string | null }>('sync_iroh_probe', { peerId: id }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ])
      setDeviceStatus((s) => ({ ...s, [id]: 'online' }))
      recordConnType(id, res.conn_type)
    } catch {
      setDeviceStatus((s) => ({ ...s, [id]: 'offline' }))
    }
  }
  const checkAllDevices = () => devices.forEach((d) => checkDevice(d.id))

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

  // 把设备类型落到后端权威白名单（决定能否全量双向同步）。
  // mine=true 要求该 fp 已配对（后端会校验）；best-effort，失败不阻塞 UI。
  // 需要紧接着发起全量同步的地方要 await 它，确保后端 is_mine 在 sync_iroh_connect 之前就位。
  const setBackendKind = async (fp: string, mine: boolean) => {
    if (!fp) return
    try {
      await invoke('sync_set_device_kind', { fingerprint: fp, mine })
    } catch {
      /* 未配对时设 mine 会失败，属正常：首次同步配对后会再设一次 */
    }
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
      const res = await invoke<{ device_name: string; conn_type?: string | null }>('sync_iroh_probe', { peerId: id })
      const finalName = res.device_name.trim() || '未命名设备'
      persistDevices([...devices, { id, name: finalName, kind: newDeviceKind }])
      recordConnType(id, res.conn_type)
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

  // 跨网「我的设备」：点「同步」用存好的 ID 发起一次全量双向同步
  const syncDevice = async (device: SavedDevice) => {
    // 首次配对码确认：iroh 的 device.id 前 16 字符即 fp（与本机 mDNS 派生口径一致）
    const fp = device.id.slice(0, 16)
    if (fp && !isPaired(fp)) {
      setPairingTarget({ kind: 'iroh-full', device, fingerprint: fp })
      return
    }
    setSyncingDeviceId(device.id)
    try {
      // 确保后端把它登记为「我的设备」，否则新的 is_mine 闸会拒绝全量同步（已配对才会成功）
      await setBackendKind(device.id.slice(0, 16), true)
      const stats = await invoke<SyncStats>('sync_iroh_connect', { peerId: device.id })
      toastSyncResult(`「${device.name}」`, stats)
      recordConnType(device.id, stats.conn_type)
      onDataChange?.()
      markSynced()
    } catch (e) {
      toast.error(`「${device.name}」同步失败：` + (e instanceof Error ? e.message : String(e)), { duration: 7000 })
    }
    setSyncingDeviceId(null)
  }

  // 配对码确认后实际触发的 iroh 同步（绕过 isPaired 检查）
  const syncDeviceConfirmed = async (device: SavedDevice) => {
    setSyncingDeviceId(device.id)
    try {
      // 配对刚完成，补登记为「我的设备」再发起全量同步
      await setBackendKind(device.id.slice(0, 16), true)
      const stats = await invoke<SyncStats>('sync_iroh_connect', { peerId: device.id })
      toastSyncResult(`「${device.name}」`, stats)
      recordConnType(device.id, stats.conn_type)
      onDataChange?.()
      markSynced()
    } catch (e) {
      toast.error(`「${device.name}」同步失败：` + (e instanceof Error ? e.message : String(e)), { duration: 7000 })
    }
    setSyncingDeviceId(null)
  }

  // 跨网「分享对象」：点「选笔记」→（未配对先弹码）→ 打开多选弹窗，只发选中的（不全量）
  const shareToDevice = (device: SavedDevice) => {
    const fp = device.id.slice(0, 16)
    if (fp && !isPaired(fp)) {
      setPairingTarget({ kind: 'iroh-select', device, fingerprint: fp })
      return
    }
    setNoteSelectTarget({ address: '', deviceName: device.name, peerId: device.id })
  }

  // 切换设备类型：我的设备 ↔ 分享对象（同时落到后端权威）
  const toggleDeviceKind = (id: string) => {
    const cur = devices.find((d) => d.id === id)
    const nextKind: DeviceKind = (cur?.kind ?? 'mine') === 'mine' ? 'shared' : 'mine'
    persistDevices(devices.map((d) => (d.id === id ? { ...d, kind: nextKind } : d)))
    // 后端权威同步：标成「我的设备」才放行全量同步；标「分享对象」立即收回该权限
    setBackendKind(id.slice(0, 16), nextKind === 'mine')
  }

  // 局域网：mDNS 搜索同网段的其它 jdnotes 设备
  const handleDiscoverLan = async () => {
    setDiscovering(true)
    try {
      const list = await invoke<{ address: string; device_name: string; fingerprint?: string; protocol?: string }[]>('sync_lan_discover')
      setDiscovered(list)
    } catch (e) {
      toast.error('搜索局域网失败：' + (e instanceof Error ? e.message : String(e)))
    }
    setDiscovering(false)
  }

  // 打开「选笔记同步」弹窗，目标可以来自 mDNS 发现或手动输入
  // mDNS 发现的会带 fingerprint，未配对先弹配对码；手输地址无 fp 直接进（用户主动信任）
  const openNoteSelect = (address: string, deviceName: string, fingerprint?: string) => {
    if (fingerprint && !isPaired(fingerprint)) {
      setPairingTarget({ kind: 'lan', address, deviceName, fingerprint })
      return
    }
    setNoteSelectTarget({ address, deviceName, fingerprint })
  }

  const handleExportSync = async () => {
    setBusy(true)
    try {
      const json = await invoke<string>('sync_export_package')
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `lapis-sync-${new Date().toISOString().split('T')[0]}.json`,
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
          {devices.length > 0 && (
            <button
              onClick={checkAllDevices}
              className="ml-auto text-xs text-gray-400 hover:text-[#5E6AD2] flex items-center gap-1 transition-colors"
              title="刷新在线状态"
            >
              <RefreshCw className="h-3 w-3" /> 刷新状态
            </button>
          )}
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
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        deviceStatus[d.id] === 'online'
                          ? 'bg-green-500'
                          : deviceStatus[d.id] === 'checking'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      title={deviceStatus[d.id] === 'online' ? '在线' : deviceStatus[d.id] === 'checking' ? '检测中' : '离线'}
                    />
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate min-w-0">{d.name}</div>
                    {connTypes[d.id] === 'direct' && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded text-green-600 dark:text-green-400 bg-green-500/10" title="上次同步：NAT 打洞直连 P2P">⚡ 直连</span>
                    )}
                    {connTypes[d.id] === 'relay' && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 bg-amber-500/10" title="上次同步：经 relay 中转">🔁 中转</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate pl-3.5">{d.id.slice(0, 20)}…</div>
                </div>
                <button
                  onClick={() => toggleDeviceKind(d.id)}
                  title="点击切换：我的设备(全量双向同步) / 分享对象(只能选笔记发)"
                  className={`shrink-0 px-2 py-1 text-[10px] rounded-md font-medium transition-colors ${
                    (d.kind ?? 'mine') === 'mine'
                      ? 'text-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20'
                      : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  {(d.kind ?? 'mine') === 'mine' ? '我的设备' : '分享对象'}
                </button>
                {(d.kind ?? 'mine') === 'mine' ? (
                  <button
                    onClick={() => syncDevice(d)}
                    disabled={syncingDeviceId !== null}
                    title="全量双向同步（适用于你自己的设备）"
                    className="px-3 py-1.5 text-xs font-medium text-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40 shrink-0"
                  >
                    {syncingDeviceId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    同步
                  </button>
                ) : (
                  <button
                    onClick={() => shareToDevice(d)}
                    title="只发送选中的笔记（适用于别人的设备）"
                    className="px-3 py-1.5 text-xs font-medium text-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    选笔记
                  </button>
                )}
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

        <div className="space-y-2">
          {/* 添加为哪种设备：决定它能全量同步还是只能选笔记发 */}
          <div className="flex gap-1.5 text-xs">
            <button
              onClick={() => setNewDeviceKind('mine')}
              className={`flex-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
                newDeviceKind === 'mine'
                  ? 'border-[#5E6AD2] bg-[#5E6AD2]/10 text-[#5E6AD2] font-medium'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              我的设备 · 全量双向同步
            </button>
            <button
              onClick={() => setNewDeviceKind('shared')}
              className={`flex-1 px-2.5 py-1.5 rounded-lg border transition-colors ${
                newDeviceKind === 'shared'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              分享对象 · 只选笔记发
            </button>
          </div>
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
        </div>
      </section>

      {/* ③ 同一网络（mDNS 自动发现 + 笔记多选） */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-[#5E6AD2]" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">同一网络</h3>
          <button
            onClick={handleDiscoverLan}
            disabled={discovering}
            className="ml-auto text-xs text-gray-400 hover:text-[#5E6AD2] flex items-center gap-1 transition-colors disabled:opacity-40"
            title="重新搜索"
          >
            {discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {discovering ? '搜索中' : '刷新'}
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
          自动发现同一 WiFi/网络下打开了 Lapis 的其它设备，点「选笔记」勾选要同步给对方的条目（可全选/单选）。
        </p>

        {/* 本机地址 */}
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

        {/* 发现的设备 */}
        {discovering && discovered.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-7 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            搜索同网段设备…
          </div>
        ) : discovered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-7 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
            <Wifi className="h-6 w-6 text-gray-300 dark:text-gray-600" />
            <p className="text-xs text-gray-400">同网段暂未发现其它设备</p>
            <p className="text-[11px] text-gray-400 px-4">
              确认对方已打开 Lapis 新版本；若被防火墙挡住，用下方手动输入地址兜底
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {discovered.map((d) => (
              <div
                key={d.address}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-[#5E6AD2]/40 hover:shadow-sm transition-all"
              >
                <div className="h-9 w-9 rounded-lg bg-[#5E6AD2]/10 flex items-center justify-center shrink-0">
                  <MonitorSmartphone className="h-4 w-4 text-[#5E6AD2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {d.device_name || '未命名设备'}
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">{d.address}</div>
                </div>
                <button
                  onClick={() => openNoteSelect(d.address, d.device_name || '未命名设备', d.fingerprint)}
                  className="px-3 py-1.5 text-xs font-medium text-[#5E6AD2] bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  选笔记
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 兜底：手动输入对方地址 */}
        <details className="group">
          <summary className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer select-none flex items-center gap-1 py-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
            手动输入对方地址（防火墙挡了 mDNS 时用）
          </summary>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={peerAddress}
              onChange={(e) => setPeerAddress(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                peerAddress.trim() &&
                openNoteSelect(peerAddress.trim(), peerAddress.trim())
              }
              placeholder="对方地址，如 192.168.1.20:38765"
              className={INPUT_CLASS}
            />
            <button
              onClick={() =>
                peerAddress.trim() && openNoteSelect(peerAddress.trim(), peerAddress.trim())
              }
              disabled={!peerAddress.trim()}
              className={PRIMARY_BTN}
            >
              <Send className="h-4 w-4" /> 选笔记
            </button>
          </div>
        </details>
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

      {/* 选笔记同步弹窗 */}
      <NoteSelectModal
        open={noteSelectTarget !== null}
        onClose={() => setNoteSelectTarget(null)}
        deviceName={noteSelectTarget?.deviceName ?? ''}
        address={noteSelectTarget?.address ?? ''}
        fingerprint={noteSelectTarget?.fingerprint}
        peerId={noteSelectTarget?.peerId}
        onSynced={() => {
          onDataChange?.()
          markSynced()
        }}
      />

      {/* 首次配对码弹窗 */}
      <PairingCodeModal
        open={pairingTarget !== null}
        onClose={() => setPairingTarget(null)}
        deviceName={
          pairingTarget && pairingTarget.kind !== 'lan'
            ? pairingTarget.device.name
            : pairingTarget?.deviceName ?? ''
        }
        remoteFingerprint={pairingTarget?.fingerprint ?? ''}
        onConfirmed={() => {
          // markPaired 已在 modal 内执行，这里按类型决定接着做什么
          if (pairingTarget?.kind === 'lan') {
            setNoteSelectTarget({ address: pairingTarget.address, deviceName: pairingTarget.deviceName, fingerprint: pairingTarget.fingerprint })
          } else if (pairingTarget?.kind === 'iroh-full') {
            syncDeviceConfirmed(pairingTarget.device)
          } else if (pairingTarget?.kind === 'iroh-select') {
            setNoteSelectTarget({ address: '', deviceName: pairingTarget.device.name, peerId: pairingTarget.device.id })
          }
        }}
      />
    </div>
  )
}
