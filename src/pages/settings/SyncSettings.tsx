import { useState, useEffect } from 'react'
import { Copy, RefreshCw, Loader2, Download, Upload, Trash2, CheckCircle, AlertCircle, Wifi, Globe, Plus } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'

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

// 把同步结果说成人话：突出「发出多少条给对方」(对方会据此更新) + 本机实际变化 + 方向，
// 避免旧文案「新增 0 更新 0」那种纯本机视角造成的「白同步了」误解。
function describeSync(stats: SyncStats): string {
  let local: string
  if (stats.inserted > 0 || stats.updated > 0) {
    local = `本机新增 ${stats.inserted}、更新 ${stats.updated}`
  } else if (stats.received > 0) {
    local = '本机已是最新，无变化'
  } else {
    local = '未收到对方数据（对方可能是旧版本，或暂无更新）'
  }
  let msg = `✓ 同步完成 ｜ 已发出 ${stats.sent} 条给对方，对方会更新；${local}`
  if (stats.conflicts > 0) {
    msg += `；⚠️ ${stats.conflicts} 处冲突已存为「冲突副本」笔记，请打开核对`
  }
  return msg
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent outline-none transition-all'

export function SyncSettings({ onDataChange }: SyncSettingsProps) {
  // 局域网同步
  const [syncInfo, setSyncInfo] = useState<{ address: string } | null>(null)
  const [peerAddress, setPeerAddress] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // 跨网同步 (iroh)：本机 ID + 已保存设备列表
  const [irohId, setIrohId] = useState<string | null>(null)
  const [devices, setDevices] = useState<SavedDevice[]>(loadDevices)
  const [newDeviceId, setNewDeviceId] = useState('')
  const [addingDevice, setAddingDevice] = useState(false)
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null)
  const [irohResult, setIrohResult] = useState<string | null>(null)

  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => localStorage.getItem('jdnotes_last_sync'))
  const [deviceName, setDeviceName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [operationMessage, setOperationMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  // 挂载时加载本机信息（同时会在后端启动局域网监听与 iroh 节点）
  useEffect(() => {
    loadSyncInfo()
    loadIrohId()
    loadDeviceName()
  }, [])

  const showMessage = (type: 'success' | 'error' | 'warning', text: string) => {
    setOperationMessage({ type, text })
    setTimeout(() => setOperationMessage(null), 5000)
  }

  // 记录一次成功同步的时间
  const markSynced = () => {
    const now = new Date().toISOString()
    localStorage.setItem('jdnotes_last_sync', now)
    setLastSyncAt(now)
  }

  const loadSyncInfo = async () => {
    try {
      setSyncInfo(await invoke<{ address: string }>('sync_get_info'))
    } catch (e) {
      console.warn('获取同步信息失败:', e)
    }
  }

  const loadIrohId = async () => {
    try {
      setIrohId(await invoke<string>('sync_iroh_get_id'))
    } catch (e) {
      console.warn('获取 iroh 设备 ID 失败:', e)
    }
  }

  const loadDeviceName = async () => {
    try {
      setDeviceName(await invoke<string>('get_device_name'))
    } catch (e) {
      console.warn('获取设备名失败:', e)
    }
  }

  const saveDeviceName = async () => {
    try {
      await invoke('set_device_name', { name: deviceName })
    } catch (e) {
      console.warn('保存设备名失败:', e)
    }
  }

  // 局域网：连接对端做一次双向同步
  const handleSync = async () => {
    const addr = peerAddress.trim()
    if (!addr) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const stats = await invoke<SyncStats>('sync_connect_lan', { address: addr })
      setSyncResult(describeSync(stats))
      onDataChange?.()
      markSynced()
    } catch (e) {
      setSyncResult('同步失败：' + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  // 设备列表持久化
  const persistDevices = (list: SavedDevice[]) => {
    setDevices(list)
    localStorage.setItem(DEVICES_KEY, JSON.stringify(list))
  }

  // 添加设备：先 probe 对端验证连通并取回它自己设的设备名（无需手动填名）
  const addDevice = async () => {
    const id = newDeviceId.trim()
    if (!id) return
    if (devices.some((d) => d.id === id)) {
      showMessage('warning', '该设备已在列表中')
      return
    }
    setAddingDevice(true)
    try {
      const name = await invoke<string>('sync_iroh_probe', { peerId: id })
      const finalName = name.trim() || '未命名设备'
      persistDevices([...devices, { id, name: finalName }])
      setNewDeviceId('')
      showMessage('success', `已连接并添加设备「${finalName}」`)
    } catch (e) {
      showMessage('error', '连接失败：' + (e instanceof Error ? e.message : String(e)) + '（请确认对方已打开应用、设备 ID 正确）')
    }
    setAddingDevice(false)
  }

  const removeDevice = (id: string) => {
    persistDevices(devices.filter((d) => d.id !== id))
  }

  // 跨网：点设备旁的「同步」，用存好的 ID 发起一次双向同步
  const syncDevice = async (device: SavedDevice) => {
    setSyncingDeviceId(device.id)
    setIrohResult(null)
    try {
      const stats = await invoke<SyncStats>('sync_iroh_connect', { peerId: device.id })
      setIrohResult(`「${device.name}」 ${describeSync(stats)}`)
      onDataChange?.()
      markSynced()
    } catch (e) {
      setIrohResult(`「${device.name}」同步失败：` + (e instanceof Error ? e.message : String(e)))
    }
    setSyncingDeviceId(null)
  }

  // 导出同步包到文件（异地手动传输）
  const handleExportSync = async () => {
    setIsLoading(true)
    try {
      const json = await invoke<string>('sync_export_package')
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `jdnotes-sync-${new Date().toISOString().split('T')[0]}.json`,
      })
      if (filePath) {
        await writeTextFile(filePath, json)
        showMessage('success', '同步包导出成功！')
      }
    } catch (e) {
      showMessage('error', '导出失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setIsLoading(false)
  }

  // 从文件导入同步包（合并）
  const handleImportSync = async () => {
    setIsLoading(true)
    try {
      const filePath = await openDialog({ filters: [{ name: 'JSON', extensions: ['json'] }], multiple: false })
      if (filePath && typeof filePath === 'string') {
        const json = await readTextFile(filePath)
        const stats = await invoke<{ inserted: number; updated: number; conflicts: number }>('sync_import_package', {
          jsonData: json,
        })
        showMessage(
          'success',
          `✓ 已合并同步包 ｜ 本机新增 ${stats.inserted}、更新 ${stats.updated}` +
            (stats.conflicts > 0 ? `；${stats.conflicts} 处冲突已存为「冲突副本」笔记，请核对` : '')
        )
        onDataChange?.()
        markSynced()
      }
    } catch (e) {
      showMessage('error', '导入失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setIsLoading(false)
  }

  // 清理无引用的图片附件（删图/删笔记后残留的孤儿文件）
  const handleGcAttachments = async () => {
    setIsLoading(true)
    try {
      const r = await invoke<{ removed: number; freed: number }>('sync_gc_attachments')
      const mb = (r.freed / 1024 / 1024).toFixed(1)
      showMessage('success', r.removed > 0 ? `已清理 ${r.removed} 张无用图片，释放 ${mb} MB` : '没有可清理的图片')
    } catch (e) {
      showMessage('error', '清理失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">设备同步</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          把两台设备的笔记互相同步。同一网络下用「局域网同步」，异地（如公司↔家）添加对方设备后一键「跨网同步」，或用「同步包」文件。
        </p>
      </div>

      {/* 操作消息提示 */}
      {operationMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-sm whitespace-pre-line flex items-start gap-3 ${
            operationMessage.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : operationMessage.type === 'warning'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}
        >
          {operationMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <span>{operationMessage.text}</span>
        </div>
      )}

      {/* 本设备名称 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">本设备名称</label>
        <input
          type="text"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          onBlur={saveDeviceName}
          placeholder="如：公司电脑 / 家里台式机"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-xs text-gray-400">同步发生冲突时，用这个名字标注笔记来自哪台设备。</p>
        {lastSyncAt && (
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            上次同步：{new Date(lastSyncAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* 局域网同步 */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">局域网同步</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          两台设备在同一 WiFi/网络下，把「本机地址」告诉对方，或输入对方地址点击同步。
        </p>

        {/* 本机地址 */}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">本机地址（告诉对方）</div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <code className="flex-1 text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
              {syncInfo?.address ?? '获取中…'}
            </code>
            {syncInfo && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(syncInfo.address)
                  showMessage('success', '已复制本机地址')
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                title="复制"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 连接对端 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={peerAddress}
            onChange={(e) => setPeerAddress(e.target.value)}
            placeholder="对方地址，如 192.168.1.20:38765"
            className={INPUT_CLASS}
          />
          <button
            onClick={handleSync}
            disabled={syncing || !peerAddress.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            同步
          </button>
        </div>
        {syncResult && <p className="text-xs text-gray-500 dark:text-gray-400">{syncResult}</p>}
      </div>

      {/* 跨网同步 (iroh) —— 设备列表 */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">跨网同步</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          不同网络（如公司↔家），通过加密 P2P 直连。把「本机设备 ID」发给对方添加，对方也把你加为设备，之后点「同步」即可，无需每次重填。
        </p>

        {/* 本机设备 ID */}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">本机设备 ID（发给对方添加）</div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <code className="flex-1 text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
              {irohId ?? '启动中…'}
            </code>
            {irohId && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(irohId)
                  showMessage('success', '已复制设备 ID')
                }}
                className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                title="复制"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 已添加的设备 */}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">已添加的设备</div>
          {devices.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2 bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              还没有添加设备。把对方的设备 ID 填到下面「添加」。
            </p>
          ) : (
            <div className="space-y-1.5">
              {devices.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 dark:text-gray-200 truncate">{d.name}</div>
                    <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate">{d.id.slice(0, 16)}…</div>
                  </div>
                  <button
                    onClick={() => syncDevice(d)}
                    disabled={syncingDeviceId !== null}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0"
                  >
                    {syncingDeviceId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    同步
                  </button>
                  <button
                    onClick={() => removeDevice(d.id)}
                    title="删除设备"
                    className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 添加设备：只填对方 ID，点添加时 probe 取回对方设备名 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newDeviceId}
            onChange={(e) => setNewDeviceId(e.target.value)}
            placeholder="粘贴对方的设备 ID，点添加自动获取名称"
            className={INPUT_CLASS}
          />
          <button
            onClick={addDevice}
            disabled={addingDevice || !newDeviceId.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {addingDevice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {addingDevice ? '连接中…' : '添加'}
          </button>
        </div>

        {irohResult && <p className="text-xs text-gray-500 dark:text-gray-400">{irohResult}</p>}
      </div>

      {/* 同步包文件兜底 + 清理 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleExportSync}
            disabled={isLoading}
            className="flex-1 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-gray-400" /> 导出同步包
          </button>
          <button
            onClick={handleImportSync}
            disabled={isLoading}
            className="flex-1 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4 text-gray-400" /> 导入同步包
          </button>
        </div>
        <button
          onClick={handleGcAttachments}
          disabled={isLoading}
          className="w-full px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> 清理无用图片
        </button>
      </div>
    </div>
  )
}
