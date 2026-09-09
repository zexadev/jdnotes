/**
 * 软件更新 Hook
 * 桌面用 tauri-plugin-updater 检查和安装更新；
 * 手机端该插件没有实现，走自家命令：mobile_update_check 比版本 → mobile_update_download 下 APK
 * → 原生桥 LapisNative.installApk 拉系统安装器（Android 同签名覆盖安装，数据保留）。
 * iOS 没有应用内安装这回事（自签分发），检查照旧，「更新」只是打开 IPA 下载地址交给用户重签
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'
import { isIOSPlatform, isMobilePlatform } from '../lib/platform'

export interface UpdateInfo {
  version: string
  currentVersion: string
  date?: string
  body?: string
}

export interface UpdateProgress {
  downloaded: number
  total: number
  percentage: number
}

export type UpdateStatus =
  | 'idle'           // 空闲状态
  | 'checking'       // 检查中
  | 'available'      // 有可用更新
  | 'not-available'  // 没有更新
  | 'downloading'    // 下载中
  | 'ready'          // 下载完成，准备安装
  | 'error'          // 错误

export interface UseUpdaterReturn {
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  progress: UpdateProgress | null
  error: string | null
  currentVersion: string
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  downloadAndInstall: () => Promise<void>
}

// Rust 侧 mobile_update_check 的返回
interface MobileUpdateInfo {
  version: string
  current_version: string
  date?: string | null
  body?: string | null
  url: string
}

// invoke 失败抛的是 Rust 的 Err(String)，不是 Error 实例
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}

export function useUpdater(): UseUpdaterReturn {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null)
  const [pendingMobile, setPendingMobile] = useState<MobileUpdateInfo | null>(null)
  // 手机端下好的 APK 路径；装完系统会直接重启进程，不用清
  const apkPathRef = useRef<string | null>(null)

  // 获取当前版本
  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(console.error)
  }, [])

  // 检查更新
  const checkForUpdates = useCallback(async () => {
    try {
      setStatus('checking')
      setError(null)
      setUpdateInfo(null)

      if (isMobilePlatform) {
        const info = await invoke<MobileUpdateInfo | null>('mobile_update_check')
        if (info) {
          setPendingMobile(info)
          setUpdateInfo({
            version: info.version,
            currentVersion: info.current_version,
            date: info.date ?? undefined,
            body: info.body ?? undefined,
          })
          setStatus('available')
        } else {
          setStatus('not-available')
        }
        return
      }

      const update = await check()

      if (update) {
        setPendingUpdate(update)
        setUpdateInfo({
          version: update.version,
          currentVersion,
          date: update.date,
          body: update.body || undefined,
        })
        setStatus('available')
      } else {
        setStatus('not-available')
      }
    } catch (err) {
      console.error('检查更新失败:', err)
      setError(errorMessage(err, '检查更新失败'))
      setStatus('error')
    }
  }, [currentVersion])

  // 手机端：下 APK 到缓存目录，进度由 Rust 按事件报。成功返回落盘路径
  const downloadMobile = useCallback(async (info: MobileUpdateInfo): Promise<string> => {
    setStatus('downloading')
    setError(null)
    setProgress({ downloaded: 0, total: 0, percentage: 0 })
    const unlisten = await listen<{ downloaded: number; total: number }>('mobile-update-progress', (event) => {
      const { downloaded, total } = event.payload
      setProgress({
        downloaded,
        total,
        percentage: total > 0 ? Math.round((downloaded / total) * 100) : 0,
      })
    })
    try {
      const path = await invoke<string>('mobile_update_download', { url: info.url, version: info.version })
      apkPathRef.current = path
      setStatus('ready')
      return path
    } finally {
      unlisten()
    }
  }, [])

  // iOS：打开 IPA 地址（Safari 下到「文件」，用户用 AltStore/Sideloadly 重签），状态留在 available 可再点
  const openIOSDownload = useCallback(async (info: MobileUpdateInfo) => {
    await openUrl(info.url)
  }, [])

  // 手机端：交给系统安装器。用户在安装器里取消了也不算错，状态留在 ready 可再点
  const installMobile = useCallback((path: string) => {
    const bridge = window.LapisNative
    if (!bridge?.installApk) throw new Error('当前环境没有安装桥，请手动安装下载好的安装包')
    const failure = bridge.installApk(path)
    if (failure) throw new Error(failure)
  }, [])

  // 下载更新
  const downloadUpdate = useCallback(async () => {
    if (isMobilePlatform) {
      if (!pendingMobile) {
        setError('没有可用的更新')
        return
      }
      try {
        if (isIOSPlatform) {
          await openIOSDownload(pendingMobile)
          return
        }
        await downloadMobile(pendingMobile)
      } catch (err) {
        console.error('下载更新失败:', err)
        setError(errorMessage(err, '下载更新失败'))
        setStatus('error')
      }
      return
    }

    if (!pendingUpdate) {
      setError('没有可用的更新')
      return
    }

    try {
      setStatus('downloading')
      setError(null)
      setProgress({ downloaded: 0, total: 0, percentage: 0 })

      let downloaded = 0
      let contentLength = 0

      await pendingUpdate.download((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const percentage = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          setProgress({
            downloaded,
            total: contentLength,
            percentage,
          })
        } else if (event.event === 'Finished') {
          setProgress({
            downloaded: contentLength,
            total: contentLength,
            percentage: 100,
          })
        }
      })

      setStatus('ready')
    } catch (err) {
      console.error('下载更新失败:', err)
      setError(errorMessage(err, '下载更新失败'))
      setStatus('error')
    }
  }, [pendingUpdate, pendingMobile, downloadMobile, openIOSDownload])

  // 安装更新
  const installUpdate = useCallback(async () => {
    if (isMobilePlatform) {
      const path = apkPathRef.current
      if (!path) {
        setError('没有可安装的更新')
        return
      }
      try {
        installMobile(path)
      } catch (err) {
        console.error('安装更新失败:', err)
        setError(errorMessage(err, '安装更新失败'))
        setStatus('error')
      }
      return
    }

    if (!pendingUpdate) {
      setError('没有可安装的更新')
      return
    }

    try {
      await pendingUpdate.install()
      // 重启应用
      await relaunch()
    } catch (err) {
      console.error('安装更新失败:', err)
      setError(errorMessage(err, '安装更新失败'))
      setStatus('error')
    }
  }, [pendingUpdate, installMobile])

  // 下载并安装（一步完成）
  const downloadAndInstall = useCallback(async () => {
    if (isMobilePlatform) {
      if (!pendingMobile) {
        setError('没有可用的更新')
        return
      }
      try {
        if (isIOSPlatform) {
          await openIOSDownload(pendingMobile)
          return
        }
        const path = await downloadMobile(pendingMobile)
        installMobile(path)
      } catch (err) {
        console.error('下载安装更新失败:', err)
        setError(errorMessage(err, '下载安装更新失败'))
        setStatus('error')
      }
      return
    }

    if (!pendingUpdate) {
      setError('没有可用的更新')
      return
    }

    try {
      setStatus('downloading')
      setError(null)
      setProgress({ downloaded: 0, total: 0, percentage: 0 })

      let downloaded = 0
      let contentLength = 0

      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const percentage = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          setProgress({
            downloaded,
            total: contentLength,
            percentage,
          })
        } else if (event.event === 'Finished') {
          setProgress({
            downloaded: contentLength,
            total: contentLength,
            percentage: 100,
          })
        }
      })

      // 重启应用
      await relaunch()
    } catch (err) {
      console.error('下载安装更新失败:', err)
      setError(errorMessage(err, '下载安装更新失败'))
      setStatus('error')
    }
  }, [pendingUpdate, pendingMobile, downloadMobile, installMobile, openIOSDownload])

  return {
    status,
    updateInfo,
    progress,
    error,
    currentVersion,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    downloadAndInstall,
  }
}
